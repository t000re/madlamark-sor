// Klikker man på et bilde i innholdet, vises det stort over hele skjermen.
// Et nytt klikk, eller Esc, lukker det igjen.
(() => {
	const bilder = [...document.querySelectorAll(".innhold img")].filter((bilde) => !bilde.closest("a, .plakat"));
	if (!bilder.length) return;

	const visning = document.createElement("dialog");
	visning.className = "bildevisning";
	visning.setAttribute("aria-label", "Bilde i full størrelse");
	const stort = document.createElement("img");
	visning.append(stort);
	document.body.append(visning);

	visning.addEventListener("click", () => visning.close());

	for (const bilde of bilder) {
		bilde.tabIndex = 0;
		const vis = () => {
			stort.src = bilde.currentSrc || bilde.src;
			stort.alt = bilde.alt;
			visning.showModal();
		};
		bilde.addEventListener("click", vis);
		bilde.addEventListener("keydown", (hendelse) => {
			if (hendelse.key === "Enter" || hendelse.key === " ") {
				hendelse.preventDefault();
				vis();
			}
		});
	}
})();
