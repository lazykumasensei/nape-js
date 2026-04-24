const which = new URLSearchParams(location.search).get("example") ?? "01";

for (const a of document.querySelectorAll<HTMLAnchorElement>("#menu a")) {
  if (a.dataset.ex === which) a.classList.add("active");
}

switch (which) {
  case "01":
    await import("./examples/01-basic.ts");
    break;
  case "02":
    await import("./examples/02-interpolation.ts");
    break;
  case "03":
    await import("./examples/03-worker-main.ts");
    break;
  default:
    document.body.insertAdjacentHTML(
      "beforeend",
      `<p style="padding:20px">Unknown example: ${which}</p>`,
    );
}
