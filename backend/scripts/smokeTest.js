const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.APP_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.resolve(__dirname, '../database/test.sqlite');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'link-town-test-secret';
process.env.MAIL_DRIVER = 'outbox';
process.env.MAIL_EXPOSE_VERIFICATION_TOKEN = 'true';
process.env.MAIL_OUTBOX_DIR = path.resolve(__dirname, '../database/test-mail-outbox');
process.env.TRANSLATION_PROVIDER = 'mock';

if (fs.existsSync(process.env.SQLITE_PATH)) {
  fs.unlinkSync(process.env.SQLITE_PATH);
}

if (fs.existsSync(process.env.MAIL_OUTBOX_DIR)) {
  fs.rmSync(process.env.MAIL_OUTBOX_DIR, { recursive: true, force: true });
}

const app = require('../app');

async function main() {
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(pathname, options = {}, expectedStatus = 200) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => null);

    assert.strictEqual(
      response.status,
      expectedStatus,
      `${options.method || 'GET'} ${pathname} expected ${expectedStatus} but got ${response.status}: ${JSON.stringify(body)}`
    );

    return body;
  }

  try {
    const health = await request('/');
    assert.strictEqual(health.message, 'Link Town Backend API is running.');

    const created = await request(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Smoke User',
          email: 'smoke@example.com',
          password: 'password123',
          age_group: '20s',
          user_type: 'volunteer'
        })
      },
      201
    );
    assert.strictEqual(created.requires_email_verification, true);
    assert.ok(created.verification_token);
    await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'smoke@example.com', password: 'password123' })
    }, 403);
    await request('/auth/email/verify', {
      method: 'POST',
      body: JSON.stringify({ verification_token: created.verification_token })
    });
    const smokeLogin = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'smoke@example.com', password: 'password123' })
    });
    assert.strictEqual(smokeLogin.user.email, 'smoke@example.com');
    await request(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Smoke User',
          email: 'smoke@example.com',
          password: 'password123'
        })
      },
      400
    );

    const login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'demo@example.com', password: 'password123' })
    });
    const userAuth = { Authorization: `Bearer ${login.token}` };
    const userId = login.user.user_id;

    const admin = await request('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ admin_id: 'admin', password: 'admin123' })
    });
    const adminAuth = { Authorization: `Bearer ${admin.token}` };

    const events = await request('/events', { headers: userAuth });
    assert.ok(events.length > 0);
    await request(`/events/${events[0].event_id}/like`, { method: 'POST', headers: userAuth }, 201);
    const likedEvents = await request(`/users/${userId}/liked-events`, { headers: userAuth });
    assert.ok(likedEvents.length > 0);
    const localizedLikedEvents = await request(`/users/${userId}/liked-events?locale=en`, { headers: userAuth });
    assert.ok(localizedLikedEvents[0].event_name.startsWith('[en] '));
    const checkIn = await request('/events/check-in', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ check_in_code: 'EVENT-1' })
    }, 201);
    assert.ok(checkIn.current_points > login.user.points);
    await request('/events/check-in', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ check_in_code: 'EVENT-1' })
    }, 400);
    const cancelledParticipation = await request(`/events/${checkIn.event_id}/participation`, {
      method: 'DELETE',
      headers: userAuth
    });
    assert.strictEqual(cancelledParticipation.event_id, checkIn.event_id);
    assert.strictEqual(cancelledParticipation.revoked_points, checkIn.granted_points);
    await request(`/events/${checkIn.event_id}/participation`, {
      method: 'DELETE',
      headers: userAuth
    }, 404);

    const services = await request('/points/services', { headers: userAuth });
    assert.ok(services.length > 0);
    assert.ok(!services[0].service_name.startsWith('[en] '));
    const localizedServices = await request('/points/services?locale=en', { headers: userAuth });
    assert.ok(localizedServices.length > 0);
    assert.ok(localizedServices[0].service_name.startsWith('[en] '));
    assert.ok(localizedServices[0].store_name.startsWith('[en] '));
    await request(`/points/services/${services[0].service_id}/favorite`, { method: 'POST', headers: userAuth }, 201);
    const favorites = await request(`/users/${userId}/favorite-services`, { headers: userAuth });
    assert.ok(favorites.length > 0);
    const localizedFavorites = await request(`/users/${userId}/favorite-services?locale=en`, { headers: userAuth });
    assert.ok(localizedFavorites[0].service_name.startsWith('[en] '));
    await request('/points/exchange', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ service_id: services[0].service_id })
    });
    const localizedHistory = await request(`/users/${userId}/history?locale=en`, { headers: userAuth });
    const localizedExchange = localizedHistory.transactions.find((entry) => entry.type === 'exchange');
    assert.ok(localizedExchange.service_name.startsWith('[en] '));

    const payment = await request(`/users/${userId}/payment-methods`, { headers: userAuth });
    const purchase = await request('/points/purchase', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ points: 50, payment_method_id: payment[0].payment_method_id, simulate_status: 'paid' })
    }, 201);
    assert.strictEqual(purchase.status, 'paid');

    const settings = await request(`/users/${userId}/settings`, { headers: userAuth });
    assert.strictEqual(settings.language, 'ja');
    await request(`/users/${userId}/settings`, {
      method: 'PUT',
      headers: userAuth,
      body: JSON.stringify({ language: 'en', font_size: 'large', notification_enabled: false })
    });

    const ticket = await request('/support/tickets', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ category: 'bug', subject: 'Smoke bug', body: 'Smoke test body' })
    }, 201);
    assert.ok(ticket.ticket_id);

    await request('/admin/notifications', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ title: 'Smoke notice', body: 'Smoke body' })
    }, 201);
    const notifications = await request(`/users/${userId}/notifications`, { headers: userAuth });
    assert.ok(notifications.length > 0);
    await request(`/notifications/${notifications[0].notification_id}/read`, { method: 'PUT', headers: userAuth });

    const createdEvent = await request('/admin/events', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        event_name: 'Smoke Event',
        event_datetime: '2026-07-01 10:00:00',
        location: 'Smoke Park',
        grant_points: 40
      })
    }, 201);
    assert.ok(createdEvent.check_in_code);
    await request(`/admin/events/${createdEvent.event_id}`, {
      method: 'PUT',
      headers: adminAuth,
      body: JSON.stringify({ status: 'paused' })
    });

    const store = await request('/admin/stores', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ store_name: 'Smoke Store' })
    }, 201);
    await request('/admin/services', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ store_id: store.store_id, service_name: 'Smoke Coupon', required_points: 10 })
    }, 201);

    const users = await request('/admin/users?search=demo', { headers: adminAuth });
    assert.ok(users.length > 0);
    await request(`/admin/users/${userId}`, { headers: adminAuth });
    const adminTickets = await request('/admin/support/tickets', { headers: adminAuth });
    assert.ok(adminTickets.length > 0);
    await request(`/admin/support/tickets/${ticket.ticket_id}`, {
      method: 'PUT',
      headers: adminAuth,
      body: JSON.stringify({ status: 'resolved', admin_note: 'smoke resolved' })
    });
    const stats = await request('/admin/stats', { headers: adminAuth });
    assert.ok(stats.total_users >= 2);

    console.log('backend smoke test passed');
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
