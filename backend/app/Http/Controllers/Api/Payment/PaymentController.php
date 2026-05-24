<?php

namespace App\Http\Controllers\Api\Payment;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Payment;
use App\Services\CourseAccessService;
use App\Services\NetopiaPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class PaymentController extends Controller
{
    public function __construct(
        private readonly NetopiaPaymentService $netopia,
        private readonly CourseAccessService $access,
    ) {}

    public function checkout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'course_slug'          => ['required', 'string', 'exists:courses,slug'],
        ]);

        $course = Course::where('slug', $data['course_slug'])
            ->where('status', 'published')
            ->firstOrFail();

        if ($this->access->userHasActiveCourseAccess($request->user(), $course)) {
            return response()->json([
                'success' => true,
                'message' => 'Ai deja acces la acest curs.',
                'data'    => [
                    'payment' => [
                        'status' => 'already_unlocked',
                        'course' => ['slug' => $course->slug],
                    ],
                ],
            ]);
        }

        try {
            $payment = $this->netopia->createCheckout(
                $request->user(),
                $course,
            );
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages([
                'payment' => $e->getMessage(),
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Sesiunea de plata a fost creata.',
            'data'    => ['payment' => $this->netopia->responseForFrontend($payment)],
        ]);
    }

    public function status(Request $request, string $orderId): JsonResponse
    {
        $payment = Payment::with('course')
            ->where('order_id', $orderId)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if (! $payment->isSuccessful()) {
            try {
                $payment = $this->netopia->syncStatus($payment);
            } catch (RuntimeException) {
                $payment = $payment->fresh('course');
            }
        }

        return response()->json([
            'success' => true,
            'data'    => ['payment' => $this->netopia->responseForFrontend($payment->fresh('course'))],
        ]);
    }
}
