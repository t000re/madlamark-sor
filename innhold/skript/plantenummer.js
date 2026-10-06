// Planteplaner: tallene i tegningene blir aktive. Holder man musa over et tall (eller
// trykker på det på mobil), vises plantene for det tallet med lenker til Wikipedia.
// Innholdet hentes fra den nummererte plantelisten under tegningen, så det står bare ett sted.

(() => {
	// Hvor tallene står i hver tegning: [nummer, x %, y %] av bildets bredde og høyde
	const PUNKTER = {
		"planteplan-alt-1": [[1, 50.7, 42.5], [2, 57.1, 17.8], [3, 51.9, 17.8], [4, 42.6, 17.8], [5, 51.4, 81.3], [6, 45.2, 81.3], [7, 45.2, 58.3], [8, 37.1, 81.3], [9, 27.0, 81.3]],
		"planteplan-alt-2": [[1, 49.3, 43.0], [2, 58.1, 13.5], [3, 46.5, 13.5], [4, 30.3, 14.0], [5, 19.9, 9.6], [6, 18.1, 51.8], [7, 12.1, 90.9], [8, 20.5, 90.9], [9, 26.6, 90.9], [10, 33.6, 90.9], [11, 36.5, 90.9], [12, 40.7, 90.9], [13, 45.1, 89.8], [14, 58.8, 83.9]],
		"planteplan-alt-3": [[1, 46.2, 43.2], [2, 54.6, 19.1], [3, 48.9, 19.1], [4, 30.0, 19.1], [5, 19.5, 19.3], [5, 18.4, 63.4], [6, 14.7, 15.5], [7, 18.4, 91.9], [8, 25.9, 91.9], [9, 37.6, 91.9], [10, 50.1, 91.9], [11, 39.5, 51.2]],
		"planteplan-alt-4": [[1, 50.0, 40.7], [2, 55.1, 13.6], [3, 48.0, 13.6], [4, 40.2, 13.6], [5, 34.1, 13.6], [6, 20.1, 14.6], [7, 19.2, 83.2], [8, 25.4, 83.2], [9, 28.8, 83.2], [10, 34.7, 83.2], [11, 54.3, 83.2], [12, 57.7, 83.2]],
		"planteplan-alt-5": [[1, 53.2, 38.9], [2, 56.3, 13.9], [3, 53.4, 13.9], [4, 47.4, 13.9], [5, 43.2, 13.9], [6, 13.4, 94.1], [7, 33.2, 84.7], [8, 44.6, 84.7], [9, 55.6, 84.7]],
		"inngangspartiet": [[1, 31.6, 43.8], [2, 33.5, 73.6], [3, 62.6, 83.6], [4, 83.2, 78.0], [5, 65.9, 39.6], [6, 57.1, 58.9]]
	};

	const bilder = [...document.querySelectorAll(".innhold img")]
		.map((bilde) => ({ bilde, navn: (bilde.getAttribute("src") || "").split("/").pop().replace(/\.\w+$/, "") }))
		.filter(({ navn }) => PUNKTER[navn]);
	if (!bilder.length) return;

	const boks = document.createElement("div");
	boks.className = "plantenummer-boks";
	boks.setAttribute("role", "dialog");
	boks.hidden = true;
	document.body.append(boks);

	let aktiv = null; // knappen boksen hører til
	let skjulTid = null;

	// Den nummererte listen etter tegningen (før neste overskrift)
	function listeEtter(bilde) {
		let el = bilde.closest("p") || bilde;
		while ((el = el.nextElementSibling)) {
			if (el.tagName === "OL") return el;
			if (/^H\d$/.test(el.tagName)) return null;
		}
		return null;
	}

	function vis(knapp) {
		clearTimeout(skjulTid);
		if (aktiv === knapp && !boks.hidden) return;
		aktiv?.setAttribute("aria-expanded", "false");
		aktiv = knapp;
		knapp.setAttribute("aria-expanded", "true");
		boks.innerHTML = "";
		const tittel = document.createElement("p");
		tittel.className = "plantenummer-tittel";
		tittel.textContent = knapp.dataset.nr;
		boks.append(tittel);
		const punkt = knapp._punkt;
		if (punkt) boks.append(...[...punkt.childNodes].map((n) => n.cloneNode(true)));
		else boks.append("Ingen planteliste funnet.");
		boks.hidden = false;
		plasser(knapp);
	}

	function plasser(knapp) {
		const r = knapp.getBoundingClientRect();
		const b = boks.getBoundingClientRect();
		const marg = 8;
		let x = r.left + r.width / 2 - b.width / 2;
		x = Math.max(marg, Math.min(x, innerWidth - b.width - marg));
		let y = r.bottom + 8;
		if (y + b.height > innerHeight - marg) y = Math.max(marg, r.top - b.height - 8);
		boks.style.left = `${x + scrollX}px`;
		boks.style.top = `${y + scrollY}px`;
	}

	function skjul(straks = false) {
		clearTimeout(skjulTid);
		const gjor = () => {
			boks.hidden = true;
			aktiv?.setAttribute("aria-expanded", "false");
			aktiv = null;
		};
		if (straks) gjor();
		else skjulTid = setTimeout(gjor, 250); // tid til å flytte musa over i boksen
	}

	for (const { bilde, navn } of bilder) {
		const liste = listeEtter(bilde);
		const ramme = document.createElement("span");
		ramme.className = "planteplan";
		bilde.replaceWith(ramme);
		ramme.append(bilde);

		for (const [nr, x, y] of PUNKTER[navn]) {
			const knapp = document.createElement("button");
			knapp.type = "button";
			knapp.className = "plantenummer";
			knapp.style.left = `${x}%`;
			knapp.style.top = `${y}%`;
			knapp.dataset.nr = nr;
			knapp.setAttribute("aria-expanded", "false");
			knapp._punkt = liste?.children[nr - 1] ?? null;
			const tekst = knapp._punkt?.textContent.trim().split(/[.:\n]/)[0].trim();
			knapp.setAttribute("aria-label", `Plante ${nr}${tekst ? ": " + tekst : ""}`);

			knapp.addEventListener("pointerenter", (h) => { if (h.pointerType === "mouse") vis(knapp); });
			knapp.addEventListener("pointerleave", (h) => { if (h.pointerType === "mouse") skjul(); });
			knapp.addEventListener("focus", () => vis(knapp));
			knapp.addEventListener("click", (h) => {
				h.stopPropagation(); // ikke åpne bildet i full størrelse
				if (aktiv === knapp && !boks.hidden && h.pointerType !== "mouse") skjul(true);
				else vis(knapp);
			});
			ramme.append(knapp);
		}
	}

	boks.addEventListener("pointerenter", () => clearTimeout(skjulTid));
	boks.addEventListener("pointerleave", (h) => { if (h.pointerType === "mouse") skjul(); });
	document.addEventListener("click", (h) => { if (!boks.hidden && !boks.contains(h.target) && !h.target.closest(".plantenummer")) skjul(true); });
	addEventListener("keydown", (h) => { if (h.key === "Escape" && !boks.hidden) { const k = aktiv; skjul(true); k?.focus(); } });
	addEventListener("resize", () => { if (aktiv && !boks.hidden) plasser(aktiv); });
})();
