const assert = require('assert');
const fs = require('fs');
const path = require('path');

const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;

function assertTranslatedName(translatedValue, sourceValue) {
  assert.ok(translatedValue);
  assert.notStrictEqual(translatedValue, sourceValue);

  if (JAPANESE_TEXT_PATTERN.test(sourceValue)) {
    assert.ok(!JAPANESE_TEXT_PATTERN.test(translatedValue.replace(/^\[en\]\s*/i, '')));
  }
}

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
const pool = require('../config/db');

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

    fs.rmSync(process.env.MAIL_OUTBOX_DIR, { recursive: true, force: true });
    fs.writeFileSync(process.env.MAIL_OUTBOX_DIR, 'temporarily unavailable', 'utf8');

    const originalConsoleError = console.error;
    console.error = () => {};
    try {
      await request(
        '/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            name: 'Pending Mail User',
            email: 'pending@example.com',
            password: 'password123'
          })
        },
        503
      );
    } finally {
      console.error = originalConsoleError;
    }

    const [pendingUsers] = await pool.query(
      'SELECT user_id, email_verified_at FROM users WHERE email = ?',
      ['pending@example.com']
    );
    assert.strictEqual(pendingUsers.length, 0);

    fs.unlinkSync(process.env.MAIL_OUTBOX_DIR);
    fs.mkdirSync(process.env.MAIL_OUTBOX_DIR, { recursive: true });

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
    const systemConnection = await request('/admin/system/connection', { headers: adminAuth });
    assert.strictEqual(systemConnection.status, 'ok');
    assert.strictEqual(systemConnection.db_client, 'sqlite');
    assert.strictEqual(systemConnection.database, 'test.sqlite');

    const events = await request('/events', { headers: userAuth });
    assert.ok(events.length > 0);
    await request(`/events/${events[0].event_id}/like`, { method: 'POST', headers: userAuth }, 201);
    const likedEvents = await request(`/users/${userId}/liked-events`, { headers: userAuth });
    assert.ok(likedEvents.length > 0);
    const localizedLikedEvents = await request(`/users/${userId}/liked-events?locale=en`, { headers: userAuth });
    assertTranslatedName(localizedLikedEvents[0].event_name, likedEvents[0].event_name);
    assert.strictEqual(localizedLikedEvents[0].location, likedEvents[0].location);
    assert.ok(localizedLikedEvents[0].description.startsWith('[en] '));
    const pointsBeforeApplication = login.user.points;
    const application = await request('/events/participate', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ event_id: events[0].event_id })
    }, 201);
    assert.strictEqual(application.participation_status, 'applied');
    const pointsAfterApplication = (await request(`/users/${userId}/points`, { headers: userAuth })).points;
    assert.strictEqual(pointsAfterApplication, pointsBeforeApplication);
    await request('/events/participate', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ event_id: events[0].event_id })
    }, 409);
    const cancelledParticipation = await request(`/events/${application.event_id}/participation`, {
      method: 'DELETE',
      headers: userAuth
    });
    assert.strictEqual(cancelledParticipation.event_id, application.event_id);
    assert.strictEqual(cancelledParticipation.participation_status, 'cancelled');
    await request(`/events/${application.event_id}/participation`, {
      method: 'DELETE',
      headers: userAuth
    }, 409);
    const reapplied = await request('/events/participate', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ event_id: events[0].event_id })
    }, 201);
    assert.strictEqual(reapplied.participation_id, application.participation_id);

    const services = await request('/points/services', { headers: userAuth });
    assert.ok(services.length > 0);
    assert.ok(!services[0].service_name.startsWith('[en] '));
    const localizedServices = await request('/points/services?locale=en', { headers: userAuth });
    assert.ok(localizedServices.length > 0);
    assertTranslatedName(localizedServices[0].service_name, services[0].service_name);
    assert.ok(!localizedServices[0].store_name.startsWith('[en] '));
    assert.ok(localizedServices[0].description.startsWith('[en] '));
    await request(`/points/services/${services[0].service_id}/favorite`, { method: 'POST', headers: userAuth }, 201);
    const favorites = await request(`/users/${userId}/favorite-services`, { headers: userAuth });
    assert.ok(favorites.length > 0);
    const localizedFavorites = await request(`/users/${userId}/favorite-services?locale=en`, { headers: userAuth });
    assertTranslatedName(localizedFavorites[0].service_name, favorites[0].service_name);
    await request(`/points/services/${services[0].service_id}/favorite`, { method: 'DELETE', headers: userAuth });
    const favoritesAfterDelete = await request(`/users/${userId}/favorite-services`, { headers: userAuth });
    assert.ok(!favoritesAfterDelete.some((service) => service.service_id === services[0].service_id));
    await request(`/points/services/${services[0].service_id}/favorite`, { method: 'POST', headers: userAuth }, 201);
    await request('/points/exchange', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ service_id: services[0].service_id })
    });
    const localizedHistory = await request(`/users/${userId}/history?locale=en`, { headers: userAuth });
    const localizedExchange = localizedHistory.transactions.find((entry) => entry.type === 'exchange');
    assertTranslatedName(localizedExchange.service_name, services[0].service_name);

    const payment = await request(`/users/${userId}/payment-methods`, { headers: userAuth });
    const purchase = await request('/points/purchase', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ points: 50, payment_method_id: payment[0].payment_method_id, simulate_status: 'paid' })
    }, 201);
    assert.strictEqual(purchase.status, 'paid');

    const pointsBeforeFailedPurchase = (await request(`/users/${userId}/points`, { headers: userAuth })).points;
    const failedPaymentMethod = await request(`/users/${userId}/payment-methods`, {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ label: 'Declined test card', brand: 'mock-fail', last4: '0002' })
    }, 201);
    const failedPurchase = await request('/points/purchase', {
      method: 'POST',
      headers: userAuth,
      body: JSON.stringify({ points: 50, payment_method_id: failedPaymentMethod.payment_method_id })
    }, 201);
    assert.strictEqual(failedPurchase.status, 'failed');
    assert.strictEqual(failedPurchase.current_points, pointsBeforeFailedPurchase);

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
    const localizedNotifications = await request(`/users/${userId}/notifications?locale=en`, { headers: userAuth });
    assert.ok(localizedNotifications[0].title.startsWith('[en] '));
    assert.ok(localizedNotifications[0].body.startsWith('[en] '));
    await request(`/notifications/${notifications[0].notification_id}/read`, { method: 'PUT', headers: userAuth });

    const [organizers] = await pool.query('SELECT organizer_id FROM event_organizers ORDER BY organizer_id LIMIT 1');
    const [submissionInsert] = await pool.query(
      `INSERT INTO event_submissions
         (organizer_id, event_name, event_datetime, event_end_datetime, location,
          requested_grant_points, status)
       VALUES (?, 'Smoke Submitted Event', '2026-08-01 10:00:00', '2026-08-01 12:00:00',
               'Smoke Hall', 30, 'pending')`,
      [organizers[0].organizer_id]
    );
    const approvedSubmission = await request(
      `/admin/event-submissions/${submissionInsert.insertId}/approve`,
      {
        method: 'POST',
        headers: adminAuth,
        body: JSON.stringify({ grant_points: 35, review_note: 'Smoke approved' })
      },
      201
    );
    assert.ok(approvedSubmission.event_id);
    await request(
      `/admin/event-submissions/${submissionInsert.insertId}/approve`,
      { method: 'POST', headers: adminAuth, body: JSON.stringify({}) },
      409
    );
    const [approvedAssignments] = await pool.query(
      'SELECT organizer_id FROM event_organizer_events WHERE event_id = ?',
      [approvedSubmission.event_id]
    );
    assert.deepStrictEqual(
      approvedAssignments.map((row) => row.organizer_id),
      [organizers[0].organizer_id]
    );

    const createdEvent = await request('/admin/events', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        event_name: 'Smoke Event',
        event_datetime: '2026-07-01 10:00:00',
        event_end_datetime: '2026-07-01 12:00:00',
        location: 'Smoke Park',
        grant_points: 40,
        description: 'Smoke event description',
        activity: 'Smoke event activity',
        notes: 'Smoke event notes'
      })
    }, 201);
    assert.ok(createdEvent.event_id);
    const [createdEventRows] = await pool.query(
      'SELECT event_datetime, description, activity, notes FROM events WHERE event_id = ?',
      [createdEvent.event_id]
    );
    assert.strictEqual(createdEventRows[0].event_datetime, '2026-07-01 10:00:00');
    assert.strictEqual(createdEventRows[0].description, 'Smoke event description');
    assert.strictEqual(createdEventRows[0].activity, 'Smoke event activity');
    assert.strictEqual(createdEventRows[0].notes, 'Smoke event notes');
    const [createdEventTranslations] = await pool.query(
      `SELECT field_name, translated_text
       FROM content_translations
       WHERE content_type = ? AND content_id = ? AND target_locale = ?
       ORDER BY field_name`,
      ['event', String(createdEvent.event_id), 'en']
    );
    assert.deepStrictEqual(createdEventTranslations.map((translation) => translation.field_name), ['description', 'event_name']);
    assert.ok(createdEventTranslations.every((translation) => translation.translated_text.startsWith('[en] ')));
    const [createdEventOrganizerAssignments] = await pool.query(
      `SELECT organizer_id
       FROM event_organizer_events
       WHERE event_id = ?`,
      [createdEvent.event_id]
    );
    assert.strictEqual(createdEventOrganizerAssignments.length, 0);
    await request(`/admin/events/${createdEvent.event_id}`, {
      method: 'PUT',
      headers: adminAuth,
      body: JSON.stringify({ status: 'paused' })
    });

    const store = await request('/admin/stores', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ store_name: 'Smoke Store', store_address: 'Smoke Address', map_query: 'Smoke Map Query' })
    }, 201);
    const createdService = await request('/admin/services', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        store_id: store.store_id,
        service_name: 'Smoke Coupon',
        description: 'Smoke coupon description',
        required_points: 10
      })
    }, 201);
    const [createdServiceTranslations] = await pool.query(
      `SELECT field_name, translated_text
       FROM content_translations
       WHERE content_type = ? AND content_id = ? AND target_locale = ?`,
      ['service', String(createdService.service_id), 'en']
    );
    assert.strictEqual(createdServiceTranslations.length, 2);
    assert.deepStrictEqual(createdServiceTranslations.map((translation) => translation.field_name).sort(), ['description', 'service_name']);
    assert.ok(createdServiceTranslations.every((translation) => translation.translated_text.startsWith('[en] ')));
    const servicesAfterAdminCreate = await request('/points/services', { headers: userAuth });
    const createdServiceForUser = servicesAfterAdminCreate.find((service) => service.service_id === createdService.service_id);
    assert.ok(createdServiceForUser);
    assert.strictEqual(createdServiceForUser.description, 'Smoke coupon description');
    assert.strictEqual(createdServiceForUser.store_address, 'Smoke Address');
    assert.strictEqual(createdServiceForUser.map_query, 'Smoke Map Query');

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
