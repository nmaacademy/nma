<?php

namespace App\Http\Controllers\Api\Payment;

use App\Http\Controllers\Controller;
use App\Services\NetopiaPaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class NetopiaWebhookController extends Controller
{
    public function __construct(private readonly NetopiaPaymentService $netopia) {}

    public function __invoke(Request $request): JsonResponse
    {
        try {
            $event = $this->netopia->processWebhook($request);
        } catch (RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 401);
        }

        return response()->json([
            'success' => true,
            'data'    => ['event_id' => $event->id],
        ]);
    }
}
