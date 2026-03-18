export interface Env {
  DB: D1Database;
  API_KEY: string;
}

function authFailed(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

function checkAuth(request: Request, env: Env): boolean {
  const key = request.headers.get("X-API-Key") ?? request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  return !!env.API_KEY && key === env.API_KEY;
}

async function parseBody<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

function rowToEntry(row: Record<string, unknown>) {
  return {
    id: row.id,
    foodTypeId: row.food_type_id,
    amount: Number(row.amount),
    timestamp: Number(row.timestamp),
  };
}

function rowToFoodType(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    color: row.color,
    priority: row.priority ?? undefined,
    weeklyMinimumAmount: row.weekly_minimum_amount != null ? Number(row.weekly_minimum_amount) : undefined,
  };
}

function rowToReminder(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    time: row.time,
    enabled: Number(row.enabled) === 1,
    repeat: row.repeat ?? undefined,
    notificationId: row.notification_id ?? undefined,
  };
}

function rowToPlanDay(row: Record<string, unknown>) {
  return {
    id: row.id,
    date: row.date,
    time: row.time,
    foodType: row.food_type,
    food: row.food,
    amountGrams: Number(row.amount_grams),
    substitutions: typeof row.substitutions === "string" ? JSON.parse(row.substitutions || "[]") : [],
    notes: row.notes ?? undefined,
    sourceMonth: Number(row.source_month),
    weekNumber: Number(row.week_number),
    scheduleId: row.schedule_id,
  };
}

function rowToLoadedSchedule(row: Record<string, unknown>) {
  return {
    id: row.id,
    month: Number(row.month),
    startDate: row.start_date,
    endDate: row.end_date,
    signsOfReadiness: typeof row.signs_of_readiness === "string" ? JSON.parse(row.signs_of_readiness || "[]") : [],
    safetyGuidelines: typeof row.safety_guidelines === "string" ? JSON.parse(row.safety_guidelines || "[]") : [],
    loadedAt: row.loaded_at,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!checkAuth(request, env)) return authFailed();

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (path === "/api/entries") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM feed_entries ORDER BY timestamp DESC").run();
        return Response.json((results as Record<string, unknown>[]).map(rowToEntry));
      }
      if (method === "POST") {
        const body = await parseBody<{ id: string; foodTypeId: string; amount: number; timestamp: number }>(request);
        if (!body?.id || body.foodTypeId == null || body.amount == null || body.timestamp == null) return badRequest("Missing fields");
        await env.DB.prepare(
          "INSERT INTO feed_entries (id, food_type_id, amount, timestamp) VALUES (?, ?, ?, ?)"
        ).bind(body.id, body.foodTypeId, body.amount, body.timestamp).run();
        return Response.json(rowToEntry({ id: body.id, food_type_id: body.foodTypeId, amount: body.amount, timestamp: body.timestamp }));
      }
    }

    const entriesIdMatch = path.match(/^\/api\/entries\/([^/]+)$/);
    if (entriesIdMatch) {
      const id = entriesIdMatch[1];
      if (method === "PATCH") {
        const body = await parseBody<Partial<{ foodTypeId: string; amount: number; timestamp: number }>>(request);
        if (!body || Object.keys(body).length === 0) return badRequest("No updates");
        const updates: string[] = [];
        const values: unknown[] = [];
        if (body.foodTypeId != null) { updates.push("food_type_id = ?"); values.push(body.foodTypeId); }
        if (body.amount != null) { updates.push("amount = ?"); values.push(body.amount); }
        if (body.timestamp != null) { updates.push("timestamp = ?"); values.push(body.timestamp); }
        if (updates.length === 0) return badRequest("No updates");
        values.push(id);
        await env.DB.prepare(`UPDATE feed_entries SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
        const { results } = await env.DB.prepare("SELECT * FROM feed_entries WHERE id = ?").bind(id).run();
        const row = (results as Record<string, unknown>[])[0];
        return row ? Response.json(rowToEntry(row)) : Response.json({}, { status: 404 });
      }
      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM feed_entries WHERE id = ?").bind(id).run();
        return new Response(null, { status: 204 });
      }
    }

    if (path === "/api/food-types") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM food_types ORDER BY id").run();
        return Response.json((results as Record<string, unknown>[]).map(rowToFoodType));
      }
      if (method === "POST") {
        const body = await parseBody<{ id: string; name: string; unit: string; color: string; priority?: string; weeklyMinimumAmount?: number }>(request);
        if (!body?.id || !body.name || body.unit == null || !body.color) return badRequest("Missing fields");
        await env.DB.prepare(
          "INSERT INTO food_types (id, name, unit, color, priority, weekly_minimum_amount) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(body.id, body.name, body.unit, body.color, body.priority ?? null, body.weeklyMinimumAmount ?? null).run();
        return Response.json(rowToFoodType({ ...body, weekly_minimum_amount: body.weeklyMinimumAmount }));
      }
    }

    const foodTypesIdMatch = path.match(/^\/api\/food-types\/([^/]+)$/);
    if (foodTypesIdMatch) {
      const id = foodTypesIdMatch[1];
      if (method === "PATCH") {
        const body = await parseBody<Partial<{ name: string; unit: string; color: string; priority: string; weeklyMinimumAmount: number }>>(request);
        if (!body || Object.keys(body).length === 0) return badRequest("No updates");
        const updates: string[] = [];
        const values: unknown[] = [];
        if (body.name != null) { updates.push("name = ?"); values.push(body.name); }
        if (body.unit != null) { updates.push("unit = ?"); values.push(body.unit); }
        if (body.color != null) { updates.push("color = ?"); values.push(body.color); }
        if (body.priority != null) { updates.push("priority = ?"); values.push(body.priority); }
        if (body.weeklyMinimumAmount != null) { updates.push("weekly_minimum_amount = ?"); values.push(body.weeklyMinimumAmount); }
        if (updates.length === 0) return badRequest("No updates");
        values.push(id);
        await env.DB.prepare(`UPDATE food_types SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
        const { results } = await env.DB.prepare("SELECT * FROM food_types WHERE id = ?").bind(id).run();
        const row = (results as Record<string, unknown>[])[0];
        return row ? Response.json(rowToFoodType(row)) : Response.json({}, { status: 404 });
      }
      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM food_types WHERE id = ?").bind(id).run();
        return new Response(null, { status: 204 });
      }
    }

    if (path === "/api/reminders") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM reminders ORDER BY time").run();
        return Response.json((results as Record<string, unknown>[]).map(rowToReminder));
      }
      if (method === "POST") {
        const body = await parseBody<{ id: string; title: string; time: string; enabled: boolean; repeat?: string; notificationId?: string }>(request);
        if (!body?.id || !body.title || body.time == null || body.enabled == null) return badRequest("Missing fields");
        await env.DB.prepare(
          "INSERT INTO reminders (id, title, time, enabled, repeat, notification_id) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(body.id, body.title, body.time, body.enabled ? 1 : 0, body.repeat ?? null, body.notificationId ?? null).run();
        return Response.json(rowToReminder({ ...body, enabled: body.enabled ? 1 : 0 }));
      }
    }

    const remindersIdMatch = path.match(/^\/api\/reminders\/([^/]+)$/);
    if (remindersIdMatch) {
      const id = remindersIdMatch[1];
      if (method === "PATCH") {
        const body = await parseBody<Partial<{ title: string; time: string; enabled: boolean; repeat: string; notificationId: string }>>(request);
        if (!body || Object.keys(body).length === 0) return badRequest("No updates");
        const updates: string[] = [];
        const values: unknown[] = [];
        if (body.title != null) { updates.push("title = ?"); values.push(body.title); }
        if (body.time != null) { updates.push("time = ?"); values.push(body.time); }
        if (body.enabled != null) { updates.push("enabled = ?"); values.push(body.enabled ? 1 : 0); }
        if (body.repeat != null) { updates.push("repeat = ?"); values.push(body.repeat); }
        if (body.notificationId != null) { updates.push("notification_id = ?"); values.push(body.notificationId); }
        if (updates.length === 0) return badRequest("No updates");
        values.push(id);
        await env.DB.prepare(`UPDATE reminders SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
        const { results } = await env.DB.prepare("SELECT * FROM reminders WHERE id = ?").bind(id).run();
        const row = (results as Record<string, unknown>[])[0];
        return row ? Response.json(rowToReminder(row)) : Response.json({}, { status: 404 });
      }
      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM reminders WHERE id = ?").bind(id).run();
        return new Response(null, { status: 204 });
      }
    }

    if (path === "/api/plan-days") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM plan_days ORDER BY date, time").run();
        return Response.json((results as Record<string, unknown>[]).map(rowToPlanDay));
      }
      if (method === "POST") {
        const body = await parseBody<{ days: Record<string, unknown>[] }>(request);
        const days = Array.isArray(body?.days) ? body.days : (Array.isArray(body) ? body : []);
        if (days.length === 0) return badRequest("Expected days array");
        for (const d of days) {
          const id = d.id as string;
          const date = d.date as string;
          const time = d.time as string;
          const foodType = d.foodType as string;
          const food = d.food as string;
          const amountGrams = Number(d.amountGrams);
          const substitutions = JSON.stringify(d.substitutions ?? []);
          const notes = (d.notes as string) ?? null;
          const sourceMonth = Number(d.sourceMonth);
          const weekNumber = Number(d.weekNumber);
          const scheduleId = d.scheduleId as string;
          if (!id || !date || time == null || !foodType || food == null || Number.isNaN(amountGrams) || Number.isNaN(sourceMonth) || Number.isNaN(weekNumber) || !scheduleId)
            return badRequest("Invalid plan day");
          await env.DB.prepare(
            "INSERT INTO plan_days (id, date, time, food_type, food, amount_grams, substitutions, notes, source_month, week_number, schedule_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(id, date, time, foodType, food, amountGrams, substitutions, notes, sourceMonth, weekNumber, scheduleId).run();
        }
        return Response.json({ ok: true });
      }
      if (method === "DELETE") {
        const scheduleId = url.searchParams.get("scheduleId");
        if (!scheduleId) return badRequest("scheduleId required");
        await env.DB.prepare("DELETE FROM plan_days WHERE schedule_id = ?").bind(scheduleId).run();
        return new Response(null, { status: 204 });
      }
    }

    const planDaysIdMatch = path.match(/^\/api\/plan-days\/([^/]+)$/);
    if (planDaysIdMatch) {
      const id = planDaysIdMatch[1];
      if (method === "PATCH") {
        const body = await parseBody<Partial<{ date: string; time: string; foodType: string; food: string; amountGrams: number; substitutions: string[]; notes: string }>>(request);
        if (!body || Object.keys(body).length === 0) return badRequest("No updates");
        const updates: string[] = [];
        const values: unknown[] = [];
        if (body.date != null) { updates.push("date = ?"); values.push(body.date); }
        if (body.time != null) { updates.push("time = ?"); values.push(body.time); }
        if (body.foodType != null) { updates.push("food_type = ?"); values.push(body.foodType); }
        if (body.food != null) { updates.push("food = ?"); values.push(body.food); }
        if (body.amountGrams != null) { updates.push("amount_grams = ?"); values.push(body.amountGrams); }
        if (body.substitutions != null) { updates.push("substitutions = ?"); values.push(JSON.stringify(body.substitutions)); }
        if (body.notes !== undefined) { updates.push("notes = ?"); values.push(body.notes ?? null); }
        if (updates.length === 0) return badRequest("No updates");
        values.push(id);
        await env.DB.prepare(`UPDATE plan_days SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
        const { results } = await env.DB.prepare("SELECT * FROM plan_days WHERE id = ?").bind(id).run();
        const row = (results as Record<string, unknown>[])[0];
        return row ? Response.json(rowToPlanDay(row)) : Response.json({}, { status: 404 });
      }
    }

    if (path === "/api/loaded-schedules") {
      if (method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM loaded_schedules ORDER BY loaded_at DESC").run();
        return Response.json((results as Record<string, unknown>[]).map(rowToLoadedSchedule));
      }
      if (method === "POST") {
        const body = await parseBody<{
          id: string; month: number; startDate: string; endDate: string;
          signsOfReadiness: string[]; safetyGuidelines: string[]; loadedAt: string;
        }>(request);
        if (!body?.id || body.month == null || !body.startDate || !body.endDate || !Array.isArray(body.signsOfReadiness) || !Array.isArray(body.safetyGuidelines) || !body.loadedAt)
          return badRequest("Missing fields");
        await env.DB.prepare(
          "INSERT INTO loaded_schedules (id, month, start_date, end_date, signs_of_readiness, safety_guidelines, loaded_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(body.id, body.month, body.startDate, body.endDate, JSON.stringify(body.signsOfReadiness), JSON.stringify(body.safetyGuidelines), body.loadedAt).run();
        return Response.json(body);
      }
    }

    const loadedSchedulesIdMatch = path.match(/^\/api\/loaded-schedules\/([^/]+)$/);
    if (loadedSchedulesIdMatch) {
      const id = loadedSchedulesIdMatch[1];
      if (method === "DELETE") {
        await env.DB.prepare("DELETE FROM loaded_schedules WHERE id = ?").bind(id).run();
        return new Response(null, { status: 204 });
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
