document.querySelectorAll(".feature-card, .btn, .item-card").forEach((el) => {
  el.addEventListener("pointerdown", () => {
    el.classList.add("pressed");
    window.setTimeout(() => el.classList.remove("pressed"), 160);
  });
});
document.querySelectorAll("form").forEach((form) => {
  form.addEventListener("submit", () => {
    const button = form.querySelector('button[type="submit"]');
    if (button && !button.dataset.noLoading) {
      button.dataset.originalText = button.innerHTML;
      button.classList.add("is-loading");
      button.disabled = true;
      window.setTimeout(() => { button.disabled = false; button.classList.remove("is-loading"); }, 5000);
    }
  });
});
