// Plakat: en aktuelt-sak med bilder står i listen som en liten dato og tittel. Klikker man
// på den, flyr dato og tittel ut til plassen sin på plakaten, og illustrasjonen og teksten
// vokser fram. Et klikk på tittelen eller datoen (uten å dra), eller Esc, lukker plakaten igjen.
//
// Delene av plakaten (tittel, dato, illustrasjon, tekst) kan flyttes rundt med musa eller fingeren.
//
//  - Mus: dra med en gang. Finger: hold et lite øyeblikk, så kan man dra (ellers ruller siden).
//  - Delen vipper litt når man drar den, som et ark man holder i, og svinger seg på plass.
//  - Slipper man i fart, glir delen litt videre og spretter mykt mot kantene.
//  - Med tastaturet: gå til en del med Tab og flytt den med piltastene (Shift for større steg).
//
// Plasseringen huskes ikke: laster man siden på nytt, står alt der det startet.

(() => {
	const plakater = document.querySelectorAll(".plakat");
	if (!plakater.length) return;

	const roligBevegelse = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const HOLDETID = 180; // ms en finger må holde før den kan dra
	const ROLIG_GRENSE = 10; // så mange px kan fingeren flytte seg før det regnes som rulling
	const FRIKSJON = 5.5; // hvor fort en slengt del bremser
	const SPRETT = 0.35; // hvor mye fart som er igjen etter et sprett mot kanten
	const FJAER = 140; // hvor stramt vippingen trekkes tilbake
	const DEMPING = 13; // hvor fort vippingen roer seg
	const MAKS_VIPP = 9; // grader

	const FLYTID = roligBevegelse ? 0 : 650; // ms for å åpne og lukke
	const MYK_UT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
	const SPRETT_UT = "cubic-bezier(0.34, 1.35, 0.5, 1)"; // litt forbi målet, så tilbake

	let lag = 10; // den sist løftede delen havner øverst
	let draDel = null; // delen som dras akkurat nå
	const aktive = new Set(); // deler som er i bevegelse
	let animerer = false;
	let forrigeTid = 0;

	const tilstander = new Map();

	for (const plakat of plakater) {
		for (const element of plakat.querySelectorAll(".plakat-del")) {
			tilstander.set(element, {
				element,
				plakat,
				x: 0, y: 0, // forskyvning fra startplassen, i px
				vx: 0, vy: 0,
				vipp: 0, vippFart: 0,
				skala: 1,
				loftet: false,
				grepY: 0, // hvor på delen man holder, -1 (topp) til 1 (bunn)
			});
			element.addEventListener("pointerdown", trykkNed);
			element.addEventListener("keydown", tast);
		}
	}

	// ---------- Åpne og lukke ----------

	const forside = document.querySelector(".forside");
	let apen = null; // { plakat, knapp, sak }
	let flyr = false; // en plakat åpnes eller lukkes akkurat nå

	// Høstoransjen ved hover legges over bildet i nøyaktig samme form
	for (const lag_ of document.querySelectorAll(".farge-maske")) {
		const bilde = lag_.querySelector("img");
		lag_.style.setProperty("--maske", `url("${bilde.src}")`);
	}

	for (const knapp of document.querySelectorAll(".plakat-knapp")) {
		// detail er 0 når knappen trykkes med tastaturet
		knapp.addEventListener("click", (hendelse) => apne(knapp, hendelse.detail === 0));
	}
	addEventListener("keydown", (hendelse) => {
		if (hendelse.key === "Escape" && apen) lukk(false, true);
	});

	const midt = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

	// Transformen som får en del til å se ut som om den ligger i boksen «mal»
	function somBoks(element, mal) {
		const fra = boksUtenTransform(element);
		const a = midt(fra);
		const b = midt(mal);
		return `translate(${b.x - a.x}px, ${b.y - a.y}px) scale(${mal.width / fra.width})`;
	}

	// Hvor delen ligger uten dra-forskyvning og vipping
	function boksUtenTransform(element) {
		const p = element.offsetParent.getBoundingClientRect();
		return new DOMRect(p.left + element.offsetLeft, p.top + element.offsetTop, element.offsetWidth, element.offsetHeight);
	}

	function smaaBilder(knapp) {
		return {
			tittel: knapp.querySelector(".knapp-tittel, .knapp-tekst"),
			dato: knapp.querySelector(".knapp-dato"),
		};
	}

	// Fokus flyttes bare for de som bruker tastaturet, så museklikk ikke gir fokusramme
	async function apne(knapp, medTastatur = false) {
		if (flyr) return;
		if (apen) lukk(true);
		const plakat = document.getElementById(knapp.getAttribute("aria-controls"));
		const sak = knapp.closest(".plakat-sak");
		const smaa = smaaBilder(knapp);
		const fra = { tittel: smaa.tittel?.getBoundingClientRect(), dato: smaa.dato?.getBoundingClientRect() };

		flyr = true;
		apen = { plakat, knapp, sak };
		plakat.hidden = false;
		nullstill(plakat);
		tilpassHoyde(plakat);
		knapp.setAttribute("aria-expanded", "true");
		forside.classList.add("plakat-apen");
		sak.classList.add("flyr");

		const animasjoner = [];
		for (const element of plakat.querySelectorAll(".plakat-del")) {
			const del = element.dataset.del;
			if (fra[del]) {
				// Tittel og dato flyr fra listen og vokser til full størrelse
				animasjoner.push(element.animate(
					[{ transform: somBoks(element, fra[del]) }, { transform: "none" }],
					{ duration: FLYTID, easing: MYK_UT }
				));
			} else {
				// Illustrasjonen og teksten vokser fram litt etter
				const forsinkelse = del === "illustrasjon" ? 160 : 280;
				animasjoner.push(element.animate(
					[
						{ opacity: 0, transform: "translateY(24px) scale(0.7) rotate(-4deg)" },
						{ opacity: 1, transform: "none" },
					],
					{ duration: FLYTID * 0.85, delay: roligBevegelse ? 0 : forsinkelse, easing: SPRETT_UT, fill: "backwards" }
				));
			}
		}
		if (medTastatur) plakat.querySelector('[data-del="tittel"]')?.focus({ preventScroll: true });
		await Promise.allSettled(animasjoner.map((a) => a.finished));
		flyr = false;
	}

	async function lukk(straks = false, medTastatur = false) {
		if (!apen || (flyr && !straks)) return;
		const { plakat, knapp, sak } = apen;
		apen = null;
		draDel = null;
		ventende && avbrytVenting();
		forside.classList.remove("plakat-apen");

		if (!straks && FLYTID) {
			flyr = true;
			const smaa = smaaBilder(knapp);
			const animasjoner = [];
			for (const element of plakat.querySelectorAll(".plakat-del")) {
				const mal = smaa[element.dataset.del]?.getBoundingClientRect();
				const naa = element.style.transform || "none";
				animasjoner.push(element.animate(
					mal
						? [{ transform: naa }, { transform: somBoks(element, mal) }]
						: [{ transform: naa, opacity: 1 }, { transform: `${naa} scale(0.8)`, opacity: 0 }],
					{ duration: mal ? FLYTID * 0.8 : FLYTID * 0.4, easing: MYK_UT, fill: "forwards" }
				));
			}
			await Promise.allSettled(animasjoner.map((a) => a.finished));
			animasjoner.forEach((a) => a.cancel());
			flyr = false;
		}

		plakat.hidden = true;
		nullstill(plakat);
		sak.classList.remove("flyr");
		knapp.setAttribute("aria-expanded", "false");
		if (medTastatur) knapp.focus({ preventScroll: true });
	}

	// Alt tilbake til startplassen
	function nullstill(plakat) {
		for (const t of tilstander.values()) {
			if (t.plakat !== plakat) continue;
			Object.assign(t, { x: 0, y: 0, vx: 0, vy: 0, vipp: 0, vippFart: 0, skala: 1, loftet: false });
			aktive.delete(t);
			t.element.style.transform = "";
			t.element.style.zIndex = "";
			t.element.classList.remove("loftet");
		}
	}

	// Plakaten må være høy nok til alle delene, også når en del er tekst og ikke bilde
	function tilpassHoyde(plakat) {
		plakat.style.minHeight = "";
		let bunn = 0;
		for (const element of plakat.querySelectorAll(".plakat-del")) {
			bunn = Math.max(bunn, element.offsetTop + element.offsetHeight);
		}
		if (bunn > plakat.clientHeight) plakat.style.minHeight = `${Math.ceil(bunn + 16)}px`;
	}

	// Når skjermen endrer størrelse, skaleres forskyvningene med plakaten
	const breddeFor = new Map([...plakater].map((p) => [p, p.clientWidth]));
	const storrelse = new ResizeObserver((endringer) => {
		for (const { target: plakat } of endringer) {
			const gammel = breddeFor.get(plakat);
			const ny = plakat.clientWidth;
			breddeFor.set(plakat, ny);
			tilpassHoyde(plakat);
			if (!gammel || !ny || gammel === ny) continue; // 0 = plakaten er skjult
			for (const t of tilstander.values()) {
				if (t.plakat !== plakat) continue;
				t.x *= ny / gammel;
				t.y *= ny / gammel;
				hold(t);
				tegn(t);
			}
		}
	});
	plakater.forEach((plakat) => {
		storrelse.observe(plakat);
		// Bildene har ingen høyde før de er lastet
		plakat.querySelectorAll("img").forEach((bilde) => bilde.addEventListener("load", () => tilpassHoyde(plakat)));
	});

	// Hvor langt delen kan flyttes uten å havne utenfor plakaten
	function grenser(t) {
		const { element, plakat } = t;
		return {
			minX: -element.offsetLeft,
			maxX: plakat.clientWidth - element.offsetLeft - element.offsetWidth,
			minY: -element.offsetTop,
			maxY: plakat.clientHeight - element.offsetTop - element.offsetHeight,
		};
	}

	// Holder delen innenfor plakaten. Med sprett snus farten mot kanten.
	function hold(t, sprett = false) {
		const g = grenser(t);
		if (t.x < g.minX) { t.x = g.minX; if (sprett) t.vx = Math.abs(t.vx) * SPRETT; }
		if (t.x > g.maxX) { t.x = g.maxX; if (sprett) t.vx = -Math.abs(t.vx) * SPRETT; }
		if (t.y < g.minY) { t.y = g.minY; if (sprett) t.vy = Math.abs(t.vy) * SPRETT; }
		if (t.y > g.maxY) { t.y = g.maxY; if (sprett) t.vy = -Math.abs(t.vy) * SPRETT; }
	}

	function tegn(t) {
		t.element.style.transform =
			`translate3d(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px, 0) rotate(${t.vipp.toFixed(2)}deg) scale(${t.skala.toFixed(3)})`;
	}

	// ---------- Dra med mus og finger ----------

	let ventende = null; // en finger som holder, men ikke har begynt å dra ennå

	function trykkNed(hendelse) {
		if (hendelse.button > 0 || draDel || flyr) return;
		const t = tilstander.get(hendelse.currentTarget);
		const start = { x: hendelse.clientX, y: hendelse.clientY, id: hendelse.pointerId, tid: performance.now() };

		if (hendelse.pointerType === "touch") {
			// Vent litt, så vanlig rulling fortsatt virker
			ventende = {
				t,
				start,
				tidtaker: setTimeout(() => {
					ventende = null;
					navigator.vibrate?.(8);
					begynnDra(t, start);
				}, HOLDETID),
			};
			return;
		}
		hendelse.preventDefault();
		begynnDra(t, start);
	}

	function begynnDra(t, start) {
		const boks = t.element.getBoundingClientRect();
		draDel = {
			t,
			id: start.id,
			start,
			// Avstanden fra pekeren til delens forskyvning, så delen ikke hopper
			grepX: start.x - t.x,
			grepY: start.y - t.y,
			sistX: start.x,
			sistY: start.y,
			sistTid: performance.now(),
		};
		t.grepY = Math.max(-1, Math.min(1, ((start.y - boks.top) / boks.height) * 2 - 1));
		t.loftet = true;
		t.vx = t.vy = 0;
		t.element.style.zIndex = ++lag;
		t.element.classList.add("loftet");
		try { t.element.setPointerCapture(start.id); } catch {}
		start_(t);
	}

	addEventListener("pointermove", (hendelse) => {
		if (ventende && hendelse.pointerId === ventende.start.id) {
			// Fingeren flyttet seg før den holdt lenge nok: det er rulling
			const flyttet = Math.hypot(hendelse.clientX - ventende.start.x, hendelse.clientY - ventende.start.y);
			if (flyttet > ROLIG_GRENSE) avbrytVenting();
			return;
		}
		if (!draDel || hendelse.pointerId !== draDel.id) return;
		const naa = performance.now();
		const dt = Math.max((naa - draDel.sistTid) / 1000, 1 / 240);
		const t = draDel.t;

		t.x = hendelse.clientX - draDel.grepX;
		t.y = hendelse.clientY - draDel.grepY;
		hold(t);

		// Jevnet ut fart, brukes til vipping og til å slenge delen når man slipper
		const myk = 1 - Math.exp(-dt / 0.05);
		t.vx += ((hendelse.clientX - draDel.sistX) / dt - t.vx) * myk;
		t.vy += ((hendelse.clientY - draDel.sistY) / dt - t.vy) * myk;
		draDel.sistX = hendelse.clientX;
		draDel.sistY = hendelse.clientY;
		draDel.sistTid = naa;
	});

	// Et kort klikk eller trykk uten å flytte på tittelen eller datoen lukker plakaten
	const erKlikk = (start, hendelse) =>
		Math.hypot(hendelse.clientX - start.x, hendelse.clientY - start.y) < 6 && performance.now() - start.tid < 500;

	function slipp(hendelse) {
		if (ventende && hendelse.pointerId === ventende.start.id) {
			const { t, start } = ventende;
			avbrytVenting();
			if (hendelse.type === "pointerup" && "lukker" in t.element.dataset && erKlikk(start, hendelse)) lukk();
			return;
		}
		if (!draDel || hendelse.pointerId !== draDel.id) return;
		const t = draDel.t;
		if (hendelse.type === "pointerup" && "lukker" in t.element.dataset && erKlikk(draDel.start, hendelse)) {
			t.loftet = false;
			t.element.classList.remove("loftet");
			draDel = null;
			lukk();
			return;
		}
		// Står pekeren stille et øyeblikk før man slipper, skal ikke delen slenges
		if (performance.now() - draDel.sistTid > 60) t.vx = t.vy = 0;
		const fart = Math.hypot(t.vx, t.vy);
		if (fart > 2500) { t.vx *= 2500 / fart; t.vy *= 2500 / fart; }
		if (roligBevegelse) t.vx = t.vy = 0;
		t.loftet = false;
		t.element.classList.remove("loftet");
		draDel = null;
		start_(t);
	}
	addEventListener("pointerup", slipp);
	addEventListener("pointercancel", slipp);

	function avbrytVenting() {
		clearTimeout(ventende.tidtaker);
		ventende = null;
	}

	// Når en finger drar en del, skal ikke siden rulle samtidig
	addEventListener("touchmove", (hendelse) => { if (draDel) hendelse.preventDefault(); }, { passive: false });

	// ---------- Tastatur ----------

	function tast(hendelse) {
		if ((hendelse.key === "Enter" || hendelse.key === " ") && "lukker" in hendelse.currentTarget.dataset) {
			hendelse.preventDefault();
			lukk(false, true);
			return;
		}
		const steg = hendelse.shiftKey ? 40 : 10;
		const retning = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[hendelse.key];
		if (!retning) return;
		hendelse.preventDefault();
		const t = tilstander.get(hendelse.currentTarget);
		t.x += retning[0] * steg;
		t.y += retning[1] * steg;
		t.element.style.zIndex = ++lag;
		hold(t);
		tegn(t);
	}

	// ---------- Bevegelse ----------

	function start_(t) {
		aktive.add(t);
		if (!animerer) {
			animerer = true;
			forrigeTid = performance.now();
			requestAnimationFrame(steg);
		}
	}

	function steg(naa) {
		const dt = Math.min((naa - forrigeTid) / 1000, 0.05);
		forrigeTid = naa;

		for (const t of aktive) {
			if (t.loftet && naa - draDel.sistTid > 40) {
				// Pekeren står stille: farten, og dermed vippingen, ebber ut
				const demp = Math.exp(-12 * dt);
				t.vx *= demp;
				t.vy *= demp;
			}
			if (!t.loftet) {
				// Glir videre etter slipp og bremses av friksjon
				const demp = Math.exp(-FRIKSJON * dt);
				t.vx *= demp;
				t.vy *= demp;
				t.x += t.vx * dt;
				t.y += t.vy * dt;
				hold(t, true);
			}

			if (!roligBevegelse) {
				// Holder man over midten, henger bunnen etter og delen vipper med fartsretningen
				const arm = Math.abs(t.grepY) < 0.35 ? -0.35 : -t.grepY;
				const mal = t.loftet ? Math.max(-MAKS_VIPP, Math.min(MAKS_VIPP, t.vx * 0.012 * arm)) : 0;
				t.vippFart += ((mal - t.vipp) * FJAER - t.vippFart * DEMPING) * dt;
				t.vipp += t.vippFart * dt;
				t.skala += ((t.loftet ? 1.04 : 1) - t.skala) * (1 - Math.exp(-14 * dt));
			}

			tegn(t);

			const iRo = !t.loftet && Math.hypot(t.vx, t.vy) < 4 && Math.abs(t.vipp) < 0.05 &&
				Math.abs(t.vippFart) < 0.05 && Math.abs(t.skala - 1) < 0.001;
			if (iRo) {
				t.vx = t.vy = t.vipp = t.vippFart = 0;
				t.skala = 1;
				tegn(t);
				aktive.delete(t);
			}
		}

		if (aktive.size) requestAnimationFrame(steg);
		else animerer = false;
	}
})();
