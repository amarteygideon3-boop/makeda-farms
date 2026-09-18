// Netlify Edge Function: verifies a Paystack payment, then marks the
// matching order as paid in Supabase. Runs on Netlify instead of Supabase,
// on the same domain as the website — so there's no cross-domain CORS step
// for the browser to fail on.

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok');
  }

  try {
    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ verified: false, reason: 'Missing reference' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` } }
    );
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return new Response(
        JSON.stringify({ verified: false, reason: paystackData.data?.gateway_response || 'Payment was not successful' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Find the matching order
    const findRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?ref=eq.${encodeURIComponent(reference)}&select=id,total,payment_status`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const orders = await findRes.json();
    if (!findRes.ok) {
      console.log('Order lookup failed:', findRes.status, JSON.stringify(orders));
    }
    const order = orders && orders[0];

    if (!order) {
      return new Response(JSON.stringify({ verified: false, reason: 'Order not found' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (order.payment_status === 'paid') {
      return new Response(JSON.stringify({ verified: true, already: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    const amountPaidCedis = paystackData.data.amount / 100;
    if (Math.abs(Number(order.total) - amountPaidCedis) > 0.01) {
      return new Response(JSON.stringify({ verified: false, reason: 'Amount does not match the order' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ payment_status: 'paid', payment_reference: reference })
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.log('Order update failed:', patchRes.status, errText);
      return new Response(JSON.stringify({ verified: false, reason: 'Payment confirmed but saving it failed: ' + errText }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ verified: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ verified: false, reason: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/verify-payment"
};
// Netlify Edge Function: verifies a Paystack payment, then marks the
// matching order as paid in Supabase. Runs on Netlify instead of Supabase,
// on the same domain as the website — so there's no cross-domain CORS step
// for the browser to fail on.

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok');
  }

  try {
    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ verified: false, reason: 'Missing reference' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}` } }
    );
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== 'success') {
      return new Response(
        JSON.stringify({ verified: false, reason: paystackData.data?.gateway_response || 'Payment was not successful' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // Find the matching order
    const findRes = await fetch(
      `${SUPABASE_URL}/rest/v1/orders?ref=eq.${encodeURIComponent(reference)}&select=id,total,payment_status`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const orders = await findRes.json();
    const order = orders && orders[0];

    if (!order) {
      return new Response(JSON.stringify({ verified: false, reason: 'Order not found' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }
    if (order.payment_status === 'paid') {
      return new Response(JSON.stringify({ verified: true, already: true }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    const amountPaidCedis = paystackData.data.amount / 100;
    if (Math.abs(Number(order.total) - amountPaidCedis) > 0.01) {
      return new Response(JSON.stringify({ verified: false, reason: 'Amount does not match the order' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ payment_status: 'paid', payment_reference: reference })
    });

    return new Response(JSON.stringify({ verified: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ verified: false, reason: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/verify-payment"
};
