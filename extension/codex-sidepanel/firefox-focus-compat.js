(() => {
  if (!/Firefox\//.test(navigator.userAgent)) return;

  const blurSuppressionWindowMs = 750;
  let suppressBlurUntil = 0;

  const isEditable = (element) =>
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element?.isContentEditable === true;

  window.addEventListener(
    "pointerdown",
    (event) => {
      const activeElement = document.activeElement;
      if (!isEditable(activeElement) || activeElement.contains(event.target)) return;

      // Firefox sidebars can transiently blur their window while focus moves
      // from the composer into a portaled dropdown. The bundled dropdown treats
      // every window blur as an outside click and otherwise closes immediately.
      suppressBlurUntil = performance.now() + blurSuppressionWindowMs;
    },
    true,
  );

  window.addEventListener(
    "mousedown",
    (event) => {
      if (!event.target?.closest?.("[aria-haspopup]")) return;

      // Radix prevents pointerdown's default action while opening a menu, but
      // Firefox still focuses the trigger during the following compatibility
      // mousedown. Radix then sees that focus as outside its portaled content
      // and dismisses the menu. Prevent only that redundant focus change.
      event.preventDefault();
    },
    true,
  );

  window.addEventListener(
    "blur",
    (event) => {
      if (performance.now() > suppressBlurUntil) return;
      suppressBlurUntil = 0;
      event.stopImmediatePropagation();
    },
    true,
  );
})();
