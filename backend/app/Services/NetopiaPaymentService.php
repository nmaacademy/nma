<?php

namespace App\Services;

use App\Models\Course;
use App\Models\Payment;
use App\Models\PaymentWebhookEvent;
use App\Models\User;
use App\Models\UserCourse;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class NetopiaPaymentService
{
    private const SUCCESS_STATUSES = [3, 5];
    private const ACTION_STATUSES = [15];
    private const FAILED_STATUSES = [4, 6, 7, 11, 12, 13, 16, 17, 18];

    public function createCheckout(User $user, Course $course): Payment
    {
        $this->assertConfigured();

        return DB::transaction(function () use ($user, $course) {
            $amount = round((float) $course->price, 2);
            $currency = strtoupper($course->currency ?: 'RON');

            $payment = Payment::create([
                'user_id'  => $user->id,
                'course_id' => $course->id,
                'provider'  => 'netopia',
                'order_id'  => $this->makeOrderId($course),
                'status'    => Payment::STATUS_PENDING,
                'amount'    => $amount,
                'currency'  => $currency,
            ]);

            $payload = $this->buildStartPayload($payment, $user, $course);

            $payment->update([
                'request_payload' => $this->safePayload($payload),
            ]);

            $response = $this->client()
                ->post($this->startEndpoint(), $payload);

            $body = $response->json() ?? [];
            $netopiaData = $this->normalizeApiResponse($body);

            if ($response->failed()) {
                $payment->update([
                    'status'           => Payment::STATUS_FAILED,
                    'response_payload' => $body,
                    'error_code'       => (string) ($body['code'] ?? data_get($netopiaData, 'error.code') ?? $response->status()),
                    'error_message'    => (string) ($body['message'] ?? data_get($netopiaData, 'error.message') ?? 'Netopia start payment failed.'),
                ]);

                throw new RuntimeException($payment->error_message ?: 'Netopia start payment failed.');
            }

            $this->applyProviderResponse($payment, $netopiaData);

            if ($payment->fresh()->isSuccessful()) {
                $this->grantCourseAccess($payment->fresh());
            }

            return $payment->fresh();
        });
    }

    public function syncStatus(Payment $payment): Payment
    {
        $this->assertConfigured();

        $payload = [
            'posID'   => $this->signature(),
            'ntpID'   => $payment->ntp_id,
            'orderID' => $payment->order_id,
        ];

        $response = $this->client()
            ->post($this->endpoint('/operation/status'), array_filter($payload));

        $body = $response->json() ?? [];
        $netopiaData = $this->normalizeApiResponse($body);

        if ($response->successful()) {
            $this->applyProviderResponse($payment, $netopiaData, 'status');

            if ($payment->fresh()->isSuccessful()) {
                $this->grantCourseAccess($payment->fresh());
            }
        }

        return $payment->fresh();
    }

    public function processWebhook(Request $request): PaymentWebhookEvent
    {
        $rawPayload = $request->getContent();
        $payload = json_decode($rawPayload, true) ?: [];
        $orderId = data_get($payload, 'order.orderID') ?? data_get($payload, 'orderID');
        $ntpId = data_get($payload, 'payment.ntpID') ?? data_get($payload, 'ntpID');
        $providerStatus = data_get($payload, 'payment.status');

        $payment = $this->resolvePayment($orderId, $ntpId);

        $event = PaymentWebhookEvent::create([
            'provider'        => 'netopia',
            'payment_id'      => $payment?->id,
            'order_id'        => $orderId,
            'ntp_id'          => $ntpId,
            'provider_status' => is_numeric($providerStatus) ? (int) $providerStatus : null,
            'verified'        => false,
            'headers'         => $this->safeHeaders($request),
            'payload'         => $payload,
            'raw_payload'     => $rawPayload,
        ]);

        $event->update([
            'verified'     => true,
            'processed_at' => now(),
        ]);

        if ($payment) {
            $this->applyProviderResponse($payment, $payload, 'webhook');
            $this->syncStatus($payment->fresh());

            $payment = $payment->fresh();
            if ($payment->isSuccessful()) {
                $this->grantCourseAccess($payment);
            }
        }

        return $event->fresh();
    }

    public function redirectUrlForPayment(Payment $payment): string
    {
        $frontend = rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/');
        $path = match ($payment->status) {
            Payment::STATUS_PAID, Payment::STATUS_CONFIRMED => '/payment/success',
            Payment::STATUS_FAILED, Payment::STATUS_CANCELED, Payment::STATUS_EXPIRED, Payment::STATUS_REFUNDED => '/payment/failed',
            default => '/payment/pending',
        };

        return $frontend . $path . '?' . http_build_query([
            'order'  => $payment->order_id,
            'course' => $payment->course?->slug,
        ]);
    }

    public function responseForFrontend(Payment $payment): array
    {
        return [
            'order_id'       => $payment->order_id,
            'ntp_id'         => $payment->ntp_id,
            'status'         => $payment->status,
            'amount'         => (float) $payment->amount,
            'currency'       => $payment->currency,
            'error_message'  => $payment->error_message,
            'customer_action' => [
                'type'                 => $payment->customer_action_type,
                'url'                  => $payment->customer_action_url,
                'authentication_token' => $payment->authentication_token,
                'form_data'            => data_get($payment->response_payload, 'customerAction.formData', []),
            ],
        ];
    }

    private function buildStartPayload(Payment $payment, User $user, Course $course): array
    {
        $redirectUrl = $this->redirectUrl() . '?' . http_build_query(['order_id' => $payment->order_id]);

        return [
            'config' => [
                'notifyUrl'   => $this->notifyUrl(),
                'redirectUrl' => $redirectUrl,
                'cancelUrl'   => $this->cancelUrl($payment),
                'language'    => 'ro',
            ],
            'payment' => [
                'options' => [
                    'installments' => 0,
                    'bonus'        => 0,
                ],
            ],
            'order' => [
                'posSignature' => $this->signature(),
                'dateTime'     => now()->format('Y-m-d\TH:i:sP'),
                'description'  => 'Achizitie curs ' . $course->title,
                'orderID'      => $payment->order_id,
                'amount'       => (float) $payment->amount,
                'currency'     => $payment->currency,
                'billing'      => $this->billingData($user),
                'shipping'     => $this->billingData($user),
                'products'     => [
                    [
                        'name'     => $course->title,
                        'code'     => $course->slug,
                        'category' => 'Curs online',
                        'price'    => (float) $payment->amount,
                        'vat'      => 0,
                    ],
                ],
                'data' => [
                    'user_id'   => (string) $user->id,
                    'course_id' => (string) $course->id,
                ],
            ],
        ];
    }

    private function applyProviderResponse(Payment $payment, array $body, ?string $context = null): void
    {
        $providerStatus = data_get($body, 'payment.status');
        $errorCode = data_get($body, 'error.code');
        $errorMessage = data_get($body, 'error.message');
        $customerAction = data_get($body, 'customerAction', []);

        $existingResponse = $payment->response_payload ?? [];
        $responsePayload = $context ? array_merge($existingResponse, [$context => $body]) : $body;

        $attributes = [
            'ntp_id'               => data_get($body, 'payment.ntpID', $payment->ntp_id),
            'provider_status'      => is_numeric($providerStatus) ? (int) $providerStatus : $payment->provider_status,
            'status'               => $this->mapStatus($providerStatus, $errorCode, $customerAction, (bool) data_get($body, 'payment.paymentURL')),
            'error_code'           => $errorCode ? (string) $errorCode : null,
            'error_message'        => $errorMessage ? (string) $errorMessage : null,
            'customer_action_type' => data_get($customerAction, 'type', $payment->customer_action_type),
            'customer_action_url'  => data_get($customerAction, 'url', data_get($body, 'payment.paymentURL', $payment->customer_action_url)),
            'authentication_token' => data_get($customerAction, 'authenticationToken', $payment->authentication_token),
            'response_payload'     => $responsePayload,
        ];

        if (in_array($attributes['status'], [Payment::STATUS_PAID, Payment::STATUS_CONFIRMED], true)) {
            $attributes['paid_at'] = $payment->paid_at ?? now();
            $attributes['confirmed_at'] = $payment->confirmed_at ?? now();
        }

        if ($context === 'webhook') {
            $attributes['last_webhook_payload'] = $body;
        }

        $payment->update($attributes);
    }

    private function normalizeApiResponse(array $body): array
    {
        if (isset($body['data']) && is_array($body['data'])) {
            return $body['data'];
        }

        return $body;
    }

    private function mapStatus(mixed $providerStatus, mixed $errorCode, array $customerAction, bool $hasPaymentUrl): string
    {
        if ($customerAction !== [] || $hasPaymentUrl || (string) $errorCode === '101') {
            return Payment::STATUS_REQUIRES_ACTION;
        }

        if (is_numeric($providerStatus)) {
            $status = (int) $providerStatus;

            if (in_array($status, self::SUCCESS_STATUSES, true)) {
                return Payment::STATUS_CONFIRMED;
            }

            if (in_array($status, self::ACTION_STATUSES, true)) {
                return Payment::STATUS_REQUIRES_ACTION;
            }

            if (in_array($status, self::FAILED_STATUSES, true)) {
                return Payment::STATUS_FAILED;
            }
        }

        if ($errorCode !== null && ! in_array((string) $errorCode, ['0', '00'], true)) {
            return Payment::STATUS_FAILED;
        }

        return Payment::STATUS_PENDING;
    }

    private function grantCourseAccess(Payment $payment): void
    {
        UserCourse::updateOrCreate(
            [
                'user_id'   => $payment->user_id,
                'course_id' => $payment->course_id,
            ],
            [
                'purchased_at'  => now(),
                'expires_at'    => null,
                'access_status' => 'active',
                'source'        => 'netopia',
                'payment_id'    => $payment->order_id,
            ]
        );
    }

    private function resolvePayment(?string $orderId, ?string $ntpId): ?Payment
    {
        if (! $orderId && ! $ntpId) {
            return null;
        }

        return Payment::query()
            ->where(function ($q) use ($orderId, $ntpId) {
                if ($orderId) {
                    $q->where('order_id', $orderId);
                }

                if ($ntpId) {
                    $q->orWhere('ntp_id', $ntpId);
                }
            })
            ->first();
    }

    private function client(): PendingRequest
    {
        $client = Http::acceptJson()
            ->asJson()
            ->withHeaders(['Authorization' => $this->apiKey()])
            ->timeout(30);

        $caBundlePath = $this->caBundlePath();

        return $caBundlePath
            ? $client->withOptions(['verify' => $caBundlePath])
            : $client;
    }

    private function endpoint(string $path): string
    {
        return rtrim($this->baseUrl(), '/') . $path;
    }

    private function startEndpoint(): string
    {
        return (string) config('services.netopia.start_endpoint');
    }

    private function baseUrl(): string
    {
        $parts = parse_url($this->startEndpoint());
        $scheme = $parts['scheme'] ?? 'https';
        $host = $parts['host'] ?? 'secure.sandbox.netopia-payments.com';

        return $scheme . '://' . $host;
    }

    private function notifyUrl(): string
    {
        return rtrim((string) config('app.url'), '/') . '/api/webhooks/netopia';
    }

    private function redirectUrl(): string
    {
        return rtrim((string) config('app.url'), '/') . '/api/payments/netopia/return';
    }

    private function cancelUrl(Payment $payment): string
    {
        return rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/') . '/payment/pending?' . http_build_query([
                'order'  => $payment->order_id,
                'course' => $payment->course?->slug,
            ]);
    }

    private function billingData(User $user): array
    {
        $parts = preg_split('/\s+/', trim($user->name), 2);

        return [
            'email'       => $user->email,
            'phone'       => $user->phone ?: '0000000000',
            'firstName'   => $parts[0] ?? $user->name,
            'lastName'    => $parts[1] ?? '-',
            'city'        => 'Bucuresti',
            'country'     => 642,
            'countryName' => 'Romania',
            'state'       => 'Bucuresti',
            'postalCode'  => '010000',
            'details'     => 'Curs online NMA Academy',
        ];
    }

    private function safePayload(array $payload): array
    {
        return $payload;
    }

    private function safeHeaders(Request $request): array
    {
        return collect($request->headers->all())
            ->except(['authorization', 'cookie'])
            ->map(fn ($value) => is_array($value) ? implode(', ', $value) : $value)
            ->all();
    }

    private function caBundlePath(): ?string
    {
        $candidates = [
            ini_get('curl.cainfo') ?: null,
            ini_get('openssl.cafile') ?: null,
            getenv('CURL_CA_BUNDLE') ?: null,
            'C:\\laragon\\etc\\ssl\\cacert.pem',
            base_path('cacert.pem'),
        ];

        foreach ($candidates as $candidate) {
            if ($candidate && is_file($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    private function makeOrderId(Course $course): string
    {
        return 'NMA-' . $course->id . '-' . Str::upper(Str::random(12));
    }

    private function assertConfigured(): void
    {
        if (! $this->apiKey() || ! $this->signature()) {
            throw new RuntimeException('NETOPIA_API_KEY and NETOPIA_SIGNATURE must be configured.');
        }
    }

    private function apiKey(): string
    {
        return (string) config('services.netopia.api_key');
    }

    private function signature(): string
    {
        return (string) config('services.netopia.signature');
    }

}
