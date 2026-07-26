// Core LifeOS domain model: lifestyle modes (outcome-based memberships),
// Swiggy MCP server catalog, and the client-side agent orchestration simulator.

export type McpServer = "food" | "instamart" | "dineout";

export type LifeModeId = "student" | "family" | "fitness" | "founder" | "couple" | "custom";

export interface LifeMode {
  id: LifeModeId;
  name: string;
  tagline: string;
  outcome: string;
  price: string;
  accent: McpServer;
  bullets: string[];
  widgets: string[];
}

export const LIFE_MODES: LifeMode[] = [
  {
    id: "student",
    name: "Student / PG",
    tagline: "Never run out of money before the month does.",
    outcome: "Outcome: eat well on ₹4,000/month",
    price: "₹99 / mo",
    accent: "food",
    bullets: [
      "Live budget guardrails on every order",
      "Late-night food under your remaining balance",
      "Group ordering + auto bill split with roommates",
      "Grocery refill reminders for the PG shelf",
    ],
    widgets: ["Budget Tracker", "Cheap Eats Nearby", "Roommate Group Order", "Refill Reminders"],
  },
  {
    id: "family",
    name: "Family",
    tagline: "A household manager that never forgets the milk.",
    outcome: "Outcome: zero kitchen emergencies",
    price: "₹249 / mo",
    accent: "instamart",
    bullets: [
      "Weekly Instamart grocery plan, auto-built",
      "Kitchen inventory + low-stock alerts",
      "Daily meal plans for kids and parents",
      "Recurring deliveries on your schedule",
    ],
    widgets: ["Pantry Inventory", "Weekly Meal Plan", "Family Planner", "Recurring Deliveries"],
  },
  {
    id: "fitness",
    name: "Fitness",
    tagline: "Your macros, ordered before you're hungry.",
    outcome: "Outcome: hit protein targets daily",
    price: "₹199 / mo",
    accent: "instamart",
    bullets: [
      "Protein-first restaurant and meal picks",
      "Calorie + macro tracking across orders",
      "Post-workout meals timed to your gym slot",
      "Planned cheat days that don't wreck the week",
    ],
    widgets: ["Calorie Tracker", "Macro Split", "Post-Workout Meals", "Hydration Reminders"],
  },
  {
    id: "founder",
    name: "Founder",
    tagline: "Feed the team. Forget the logistics.",
    outcome: "Outcome: pantry never empty, team never hangry",
    price: "₹499 / mo",
    accent: "dineout",
    bullets: [
      "Predictive office pantry refills",
      "Team lunches scheduled around the calendar",
      "Late-night sprint food that isn't junk",
      "Company food spend tracked and exportable",
    ],
    widgets: ["Pantry Forecast", "Team Orders", "Expense Ledger", "Meeting Catering"],
  },
  {
    id: "couple",
    name: "Couple",
    tagline: "Date nights that plan themselves.",
    outcome: "Outcome: you never miss a date again",
    price: "₹299 / mo",
    accent: "dineout",
    bullets: [
      "Dineout tables reserved on your best evenings",
      "Anniversary + important date memory",
      "Surprise deliveries scheduled in advance",
      "Personalised gift and cuisine suggestions",
    ],
    widgets: ["Date Night Planner", "Reservations", "Important Dates", "Surprise Queue"],
  },
  {
    id: "custom",
    name: "Custom",
    tagline: "Blend any two lives into one routine.",
    outcome: "Outcome: an OS shaped exactly like you",
    price: "₹349 / mo",
    accent: "food",
    bullets: [
      "Mix Student + Fitness, Founder + Family, anything",
      "Compose your own agent routines",
      "Per-routine triggers, budgets and schedules",
      "Switch blends any time",
    ],
    widgets: ["Routine Builder", "Custom Widgets", "Trigger Rules", "Blend Analytics"],
  },
];

export const MCP_SERVERS: Record<
  McpServer,
  { label: string; blurb: string; tools: string[] }
> = {
  food: {
    label: "Food MCP",
    blurb: "Restaurant discovery, menus, ordering, live delivery tracking.",
    tools: [
      "food.search_restaurants",
      "food.get_menu",
      "food.place_order",
      "food.track_delivery",
      "food.split_bill",
    ],
  },
  instamart: {
    label: "Instamart MCP",
    blurb: "Grocery discovery, pantry state, recurring orders, inventory suggestions.",
    tools: [
      "instamart.search_products",
      "instamart.get_pantry_state",
      "instamart.add_to_cart",
      "instamart.schedule_recurring",
      "instamart.checkout",
    ],
  },
  dineout: {
    label: "Dineout MCP",
    blurb: "Table availability, reservations, offers, date-night planning.",
    tools: [
      "dineout.search_availability",
      "dineout.compare_ratings",
      "dineout.reserve_table",
      "dineout.get_offers",
    ],
  },
};

export interface AgentStep {
  server: McpServer | "agent";
  tool: string;
  detail: string;
}

export interface AgentRun {
  intent: string;
  plan: string;
  steps: AgentStep[];
  answer: string;
}

const RUNS: { match: RegExp; run: (q: string) => AgentRun }[] = [
  {
    match: /groc|fridge|pantry|instamart|list/i,
    run: () => ({
      intent: "Grocery replenishment",
      plan: "Read pantry state → find gaps → build cart → schedule the slot",
      steps: [
        { server: "agent", tool: "memory.recall", detail: "Brands you repeat: Amul, Tata Sampann, Safal" },
        { server: "instamart", tool: "instamart.get_pantry_state", detail: "9 staples low, 3 out of stock" },
        { server: "instamart", tool: "instamart.search_products", detail: "Matched 14 items to your usual brands" },
        { server: "instamart", tool: "instamart.add_to_cart", detail: "Cart built · ₹1,842 · under weekly cap" },
        { server: "instamart", tool: "instamart.schedule_recurring", detail: "Delivery slot Sat 8–9 AM, repeats weekly" },
      ],
      answer:
        "Your week is stocked: 14 items in the cart at ₹1,842 (₹158 under your weekly cap), arriving Saturday 8–9 AM and repeating weekly. I skipped rice — you still have 4kg.",
    }),
  },
  {
    match: /book|table|reserv|date|anniversar|surprise|romantic/i,
    run: () => ({
      intent: "Date night orchestration",
      plan: "Discover → compare → reserve → remind",
      steps: [
        { server: "agent", tool: "memory.recall", detail: "You both loved Italian; she avoids shellfish" },
        { server: "food", tool: "food.search_restaurants", detail: "11 Italian places within 6 km" },
        { server: "dineout", tool: "dineout.compare_ratings", detail: "Shortlisted 3 above 4.5★" },
        { server: "dineout", tool: "dineout.get_offers", detail: "20% off pre-booked tables at Toscano" },
        { server: "dineout", tool: "dineout.reserve_table", detail: "Table for 2 · 8:30 PM · window seat" },
        { server: "agent", tool: "routine.schedule", detail: "Cab reminder set for 7:55 PM" },
      ],
      answer:
        "Booked Toscano, 8:30 PM, window seat for two, with 20% off via Dineout. Shellfish-free menu flagged, and I'll nudge you for a cab at 7:55 PM.",
    }),
  },
  {
    match: /protein|gym|calorie|healthy|macro|workout/i,
    run: () => ({
      intent: "Fitness-aligned meal",
      plan: "Read macros left → filter high-protein → order → log",
      steps: [
        { server: "agent", tool: "memory.recall", detail: "Target 150g protein · 78g logged today" },
        { server: "food", tool: "food.search_restaurants", detail: "High-protein bowls, 25 min radius" },
        { server: "food", tool: "food.get_menu", detail: "Grilled chicken quinoa bowl · 48g protein · 520 kcal" },
        { server: "instamart", tool: "instamart.add_to_cart", detail: "Whey + Greek yogurt added to tonight's cart" },
        { server: "food", tool: "food.place_order", detail: "Order placed · ETA 28 min" },
      ],
      answer:
        "Grilled chicken quinoa bowl on the way — 48g protein, 520 kcal, ETA 28 min. That puts you at 126g of your 150g target; the yogurt in tonight's Instamart cart closes the gap.",
    }),
  },
  {
    match: /budget|cheap|under|₹|\brs\b|afford|split|friends|hosting/i,
    run: () => ({
      intent: "Budget-constrained ordering",
      plan: "Analyse spend → filter by remaining budget → order → split",
      steps: [
        { server: "agent", tool: "analytics.spend", detail: "₹1,120 left for 9 days · ₹124/day safe" },
        { server: "food", tool: "food.search_restaurants", detail: "22 options under your per-meal cap" },
        { server: "food", tool: "food.get_menu", detail: "Picked 3 combos rated 4.2★+" },
        { server: "food", tool: "food.place_order", detail: "Order placed · ₹238 total" },
        { server: "food", tool: "food.split_bill", detail: "Split 4 ways · requests sent to roommates" },
      ],
      answer:
        "Ordered a ₹238 combo that keeps you inside today's ₹124 safe spend after the split. Bill split four ways and requests are already with your roommates.",
    }),
  },
  {
    match: /breakfast|every|daily|8 ?am|routine|schedule|morning/i,
    run: () => ({
      intent: "Recurring routine",
      plan: "Create trigger → bind tools → confirm cadence",
      steps: [
        { server: "agent", tool: "routine.create", detail: "Trigger: weekdays 07:20 IST" },
        { server: "instamart", tool: "instamart.get_pantry_state", detail: "Checks eggs/bread before ordering out" },
        { server: "food", tool: "food.search_restaurants", detail: "Rotates 4 breakfast spots to avoid fatigue" },
        { server: "food", tool: "food.place_order", detail: "Auto-order 40 min before your 8 AM slot" },
      ],
      answer:
        "Weekday breakfast routine is live. I check the pantry first — if eggs and bread are stocked I skip the order and just remind you. Otherwise breakfast lands at 8 AM sharp.",
    }),
  },
];

const FALLBACK: AgentRun = {
  intent: "General lifestyle request",
  plan: "Understand → pick servers → execute → learn",
  steps: [
    { server: "agent", tool: "intent.classify", detail: "Routed across Food + Instamart + Dineout" },
    { server: "food", tool: "food.search_restaurants", detail: "Ranked against your taste memory" },
    { server: "instamart", tool: "instamart.get_pantry_state", detail: "Cross-checked what's already at home" },
    { server: "agent", tool: "memory.write", detail: "Preference saved for next time" },
  ],
  answer:
    "Handled. I compared eating out against what's already in your kitchen, picked the option that fits today's budget and schedule, and remembered the choice for next time.",
};

export function runAgent(query: string): AgentRun {
  const hit = RUNS.find((r) => r.match.test(query));
  return hit ? hit.run(query) : FALLBACK;
}

export const SAMPLE_PROMPTS = [
  "Order dinner under ₹250",
  "Plan this week's groceries",
  "Book a table tonight",
  "I'm hungry but want high protein",
  "My fridge is almost empty",
  "Order breakfast every weekday at 8 AM",
  "Plan a surprise dinner for Friday",
  "I'm hosting five friends tonight",
];

export interface OnboardingQuestion {
  id: string;
  ai: string;
  options: string[];
  scores: Partial<Record<LifeModeId, number>>[];
}

export const ONBOARDING: OnboardingQuestion[] = [
  {
    id: "life",
    ai: "Let's skip the forms. In one line — what does your life look like right now?",
    options: [
      "Studying, living in a PG or hostel",
      "Running a startup or deep in work",
      "Married / living with family",
      "Living with my partner",
    ],
    scores: [{ student: 3 }, { founder: 3 }, { family: 3 }, { couple: 3 }],
  },
  {
    id: "budget",
    ai: "How much do you spend on food in a month, roughly?",
    options: ["Under ₹5,000", "₹5,000 – ₹12,000", "₹12,000 – ₹25,000", "₹25,000+"],
    scores: [{ student: 3 }, { fitness: 1, couple: 1 }, { family: 2 }, { founder: 2, couple: 1 }],
  },
  {
    id: "cook",
    ai: "Who handles the kitchen on a normal Tuesday?",
    options: [
      "Nobody — I order everything",
      "I cook when I get time",
      "There's a full household kitchen",
      "Meal-prep, strictly measured",
    ],
    scores: [{ student: 2, founder: 2 }, { custom: 1 }, { family: 3 }, { fitness: 3 }],
  },
  {
    id: "health",
    ai: "What matters most about what you eat?",
    options: ["Cheapest that tastes good", "Protein and macros", "Healthy for the whole family", "Great experiences"],
    scores: [{ student: 3 }, { fitness: 3 }, { family: 3 }, { couple: 3 }],
  },
  {
    id: "hours",
    ai: "And your hours — when does the day usually end?",
    options: ["Before 8 PM", "Around 10 PM", "Past midnight, often", "Wildly unpredictable"],
    scores: [{ family: 2 }, { couple: 2 }, { founder: 3, student: 1 }, { custom: 3 }],
  },
  {
    id: "pain",
    ai: "Last one. What would you most like to stop thinking about?",
    options: [
      "Running out of money mid-month",
      "Groceries and restocking",
      "Hitting my fitness targets",
      "Planning time with people I love",
    ],
    scores: [{ student: 3 }, { family: 3 }, { fitness: 3 }, { couple: 3 }],
  },
];

export function recommendMode(answers: number[]): LifeModeId {
  const tally: Record<string, number> = {};
  answers.forEach((choice, i) => {
    const q = ONBOARDING[i];
    if (!q || choice < 0) return;
    const s = q.scores[choice] ?? {};
    for (const [k, v] of Object.entries(s)) tally[k] = (tally[k] ?? 0) + (v ?? 0);
  });
  const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return (best?.[0] as LifeModeId) ?? "custom";
}

export const MEMORY_FACTS = [
  "Avoids shellfish · noted from 3 orders",
  "Prefers Amul over Nandini · 11 repeats",
  "Gym at 7 AM Mon/Wed/Fri",
  "Anniversary: 14 Feb",
  "Office: Koramangala, 5th Block",
  "Never orders biryani on weekdays",
  "Weekly grocery cap: ₹2,000",
  "Favourite: Toscano, Meghana's, Rameshwaram Café",
];
