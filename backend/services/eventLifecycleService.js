async function addParticipationHistory(
  connection,
  participationId,
  fromStatus,
  toStatus,
  { reason = null, actorType, actorId = null }
) {
  await connection.query(
    `INSERT INTO event_participation_status_history
       (participation_id, from_status, to_status, reason, actor_type, actor_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [participationId, fromStatus, toStatus, reason, actorType, actorId == null ? null : String(actorId)]
  );
}

async function grantCompletionPoints(
  connection,
  participation,
  { method, note = null, adminId = null, actorType, actorId = null }
) {
  if (participation.status === 'completed') {
    return { conflict: true };
  }

  const points = Number(participation.grant_points_snapshot || 0);
  await connection.query(
    `UPDATE participations
     SET status = 'completed',
         granted_points = ?,
         completed_at = CURRENT_TIMESTAMP,
         completion_method = ?,
         completion_note = ?,
         completed_by_admin_id = ?
     WHERE participation_id = ?`,
    [points, method, note, adminId, participation.participation_id]
  );
  await connection.query('UPDATE users SET points = points + ? WHERE user_id = ?', [
    points,
    participation.user_id
  ]);
  await connection.query(
    `INSERT INTO point_transactions
       (user_id, participation_id, type, points, description)
     VALUES (?, ?, 'grant', ?, ?)`,
    [
      participation.user_id,
      participation.participation_id,
      points,
      `Points granted for event: ${participation.event_name}`
    ]
  );
  await addParticipationHistory(
    connection,
    participation.participation_id,
    participation.status,
    'completed',
    { reason: note, actorType, actorId }
  );
  const [users] = await connection.query('SELECT points FROM users WHERE user_id = ?', [
    participation.user_id
  ]);
  return { conflict: false, grantedPoints: points, currentPoints: Number(users[0]?.points || 0) };
}

async function closeEvent(connection, eventId, { actorType, actorId, reason = null }) {
  const [events] = await connection.query(
    'SELECT event_id, status FROM events WHERE event_id = ? FOR UPDATE',
    [eventId]
  );
  if (events.length === 0) {
    return { status: 404, body: { message: 'Event not found.' } };
  }
  if (!['active', 'paused'].includes(events[0].status)) {
    return { status: 409, body: { message: 'Event is already closed.' } };
  }

  const [participations] = await connection.query(
    `SELECT participation_id, status
     FROM participations
     WHERE event_id = ? AND status IN ('applied', 'checked_in')
     FOR UPDATE`,
    [eventId]
  );
  await connection.query("UPDATE events SET status = 'completed' WHERE event_id = ?", [eventId]);
  for (const participation of participations) {
    const nextStatus = participation.status === 'applied' ? 'absent' : 'incomplete';
    await connection.query('UPDATE participations SET status = ? WHERE participation_id = ?', [
      nextStatus,
      participation.participation_id
    ]);
    await addParticipationHistory(
      connection,
      participation.participation_id,
      participation.status,
      nextStatus,
      { reason: reason || 'Event closed', actorType, actorId }
    );
  }
  return {
    status: 200,
    body: {
      message: 'Event closed successfully.',
      event_id: Number(eventId),
      absent_count: participations.filter((item) => item.status === 'applied').length,
      incomplete_count: participations.filter((item) => item.status === 'checked_in').length
    }
  };
}

module.exports = {
  addParticipationHistory,
  closeEvent,
  grantCompletionPoints
};
