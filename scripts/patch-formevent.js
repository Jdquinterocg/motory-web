const fs = require("fs");

const files = [
  "packages/web/src/pages/ProductNewPage.tsx",
  "packages/web/src/pages/ProductDetailPage.tsx",
  "packages/web/src/pages/InventoryEntryPage.tsx",
];

for (const f of files) {
  let t = fs.readFileSync(f, "utf8");
  if (!t.includes("FormEvent") && !t.includes("React.FormEvent")) {
    // still check React.FormEvent after decode
  }
  if (t.includes("React.FormEvent") || t.includes("onSubmit(e: React.FormEvent)")) {
    if (!t.includes("type FormEvent")) {
      t = t.replace(
        "import { useState }",
        "import { useState, type FormEvent }",
      );
      t = t.replace(
        "import { useEffect, useState }",
        "import { useEffect, useState, type FormEvent }",
      );
    }
    t = t.replace(/React\.FormEvent/g, "FormEvent");
    fs.writeFileSync(f, t);
    console.log("patched", f);
  } else {
    console.log("skip", f);
  }
}
