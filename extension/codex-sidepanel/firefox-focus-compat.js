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
    "blur",
    (event) => {
      if (performance.now() > suppressBlurUntil) return;
      suppressBlurUntil = 0;
      event.stopImmediatePropagation();
    },
    true,
  );
})();
