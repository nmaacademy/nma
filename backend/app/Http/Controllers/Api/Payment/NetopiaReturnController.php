<?php

namespace App\Http\Controllers\Api\Payment;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\NetopiaPaymentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class NetopiaReturnController extends Controller
{
    public function __construct(private readonly NetopiaPaymentService $netopia) {}

    public function __invoke(Request $request): RedirectResponse
    {
        $orderId = $request->query('order_id') ?? $request->input('orderID');

        $payment = Payment::with('course')->where('order_id', $orderId)->first();

        if (! $payment) {
            return redirect()->away(rtrim((string) env('FRONTEND_URL', 'http://localhost:3000'), '/') . '/payment/failed');
        }

        $payment = $this->netopia->syncStatus($payment);

        return redirect()->away($this->netopia->redirectUrlForPayment($payment->fresh('course')));
    }
}
