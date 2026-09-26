const fs = require("fs");
const f = "packages/api/src/handlers/router.ts";
let t = fs.readFileSync(f, "utf8");

t = t.replace(
  `function pathParams(event: APIGatewayProxyEventV2): Record<string, string> {
  return event.pathParameters ?? {};
}`,
  `function pathParams(event: APIGatewayProxyEventV2): Record<string, string> {
  const raw = event.pathParameters ?? {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}`,
);

t = t.replace(
  `const range = q.from || q.to || q.preset ? resolveDateRange(q) : {};
      const movements = await services.inventory.listMovements({
        from: range.from ?? q.from,
        to: range.to ?? q.to,`,
  `const range: { from?: string; to?: string } =
        q.from || q.to || q.preset ? resolveDateRange(q) : {};
      const movements = await services.inventory.listMovements({
        from: range.from ?? q.from,
        to: range.to ?? q.to,`,
);

fs.writeFileSync(f, t, "utf8");
console.log("patched router.ts");
