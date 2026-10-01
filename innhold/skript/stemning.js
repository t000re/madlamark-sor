// Stemning: når en aktuelt-sak med «stemning: host» eller «stemning: var» er
// åpen, driver det noen små ting over siden.
//
//  host – lønneblader og bjørkeblader som blåser forbi og faller
//  var  – løvetannfrø og villblomster som blåser oppover
//
// Formene er enkle og flate, men bevegelsen følger en liten fysikkmodell:
//  - vinden har en jevn bris med kast som kommer og går
//  - luftmotstand drar tingen mot vindens fart, tunge ting henger mer etter
//  - blader pendler fram og tilbake mens de faller, frø svaier under fallskjermen
//  - ting snurrer rundt sin egen akse, mer når vinden river i dem
//  - klikker man på noe, tar et kort vindpust det med seg i en tilfeldig retning.
//    Pustet bygger seg mykt opp og dør ut, og banen svinger litt underveis.

(() => {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

	const saker = document.querySelectorAll(".aktuelt-sak[data-stemning]");
	if (!saker.length) return;

	const tilfeldig = (min, maks) => min + Math.random() * (maks - min);
	const velg = (liste) => liste[Math.floor(Math.random() * liste.length)];
	const MORK = "#3d1a08";

	let lerret, ctx, bredde, hoyde, skala;
	let svevere = [];
	let tid = 0;
	let forrige = 0;
	let animerer = false;
	const aktive = new Set();
	const nesteTid = {};

	// ---------- Vind ----------

	// En jevn bris med kast som bygger seg opp og løyer av
	function vind(t, y, styrke, kastStyrke) {
		const kast = Math.sin(t * 0.31) + 0.6 * Math.sin(t * 0.73 + 1.3) + 0.3 * Math.sin(t * 1.9 + y * 0.004);
		return {
			x: styrke + kastStyrke * Math.max(kast, -0.8),
			y: 12 * Math.sin(t * 0.57 + y * 0.003),
		};
	}

	// Farten nærmer seg målet mykt, uavhengig av bildefrekvens
	const mot = (fra, til, k, dt) => fra + (til - fra) * (1 - Math.exp(-k * dt));

	// ---------- Former (tegnes rundt (0, 0), høyde omtrent 2) ----------

	function speil(hoyreSide, topp, bunn) {
		const flate = new Path2D();
		flate.moveTo(...topp);
		hoyreSide.forEach(([x, y]) => flate.lineTo(x, y));
		if (bunn) flate.lineTo(...bunn);
		[...hoyreSide].reverse().forEach(([x, y]) => flate.lineTo(-x, y));
		flate.closePath();
		return flate;
	}

	// Lønneblad: tre store fliker og to små, med tenner langs kanten
	function lagLonneblad() {
		const flate = speil(
			[
				[0.14, -0.72], [0.26, -0.78], [0.22, -0.46], [0.34, -0.52], // midtfliken
				[0.18, -0.16], // innskjæring
				[0.5, -0.3], [0.58, -0.44], [0.66, -0.3], [0.96, -0.46], // sideflik
				[0.84, -0.18], [0.94, -0.1], [0.62, 0.08], [0.66, 0.18],
				[0.4, 0.16], // innskjæring
				[0.46, 0.36], [0.12, 0.24], [0.05, 0.3], // nedre flik
			],
			[0, -1]
		);
		const nerver = new Path2D();
		for (const [x, y] of [[0, -0.85], [0.8, -0.38], [-0.8, -0.38], [0.38, 0.3], [-0.38, 0.3]]) {
			nerver.moveTo(0, 0.2);
			nerver.lineTo(x, y);
		}
		nerver.moveTo(0, 0.2);
		nerver.lineTo(0, 0.7); // stilk
		return { flate, nerver };
	}

	// Bjørkeblad: spiss topp, bredest nær basen og sagtakket kant
	function lagBjorkeblad() {
		const tenner = 10;
		const profil = (s) => Math.pow(s, 1.3) * Math.pow(1 - s, 0.45);
		const maks = profil(1.3 / 1.75);
		const bredde = (s) => (0.55 * profil(s)) / maks;
		const side = [];
		for (let i = 1; i < tenner * 2; i++) {
			const s = i / (tenner * 2); // 0 = spissen, 1 = basen
			let x = bredde(s);
			if (i % 2 === 1) x += 0.06 * Math.sqrt(s); // tannspiss
			side.push([x, -1 + 1.5 * s]);
		}
		const flate = speil(side, [0, -1], [0, 0.5]);

		const nerver = new Path2D();
		nerver.moveTo(0, -0.85);
		nerver.lineTo(0, 0.85); // midtnerve og stilk
		// Sidenervene går skrått oppover og stopper like innenfor kanten
		for (const y of [-0.35, -0.1, 0.12, 0.3]) {
			const yEnde = y - 0.2;
			const xEnde = 0.8 * bredde((yEnde + 1) / 1.5);
			for (const retning of [1, -1]) {
				nerver.moveTo(0, y);
				nerver.lineTo(xEnde * retning, yEnde);
			}
		}
		return { flate, nerver };
	}

	// Blomst sett ovenfra: runde kronblader rundt en midte
	function lagBlomst(antall, lengde, bredde) {
		const kronblader = new Path2D();
		for (let i = 0; i < antall; i++) {
			const v = (i / antall) * Math.PI * 2;
			const [cx, cy] = [Math.cos(v) * lengde * 0.55, Math.sin(v) * lengde * 0.55];
			kronblader.ellipse(cx, cy, lengde * 0.5, bredde, v, 0, Math.PI * 2);
		}
		const midte = new Path2D();
		midte.arc(0, 0, 0.3, 0, Math.PI * 2);
		return { kronblader, midte };
	}

	const FORMER = {
		lonn: lagLonneblad(),
		bjork: lagBjorkeblad(),
		femblad: lagBlomst(5, 1, 0.42), // smørblomst, kornblomst, geranium
		prestekrage: lagBlomst(12, 1, 0.17),
	};

	// ---------- Høst: blader som faller ----------

	const BLADARTER = {
		lonn: {
			farger: ["#c2452d", "#f46012", "#a75235", "#b8321f"],
			storrelse: 15,
			svingFart: [1.5, 2.2], // brede blader pendler roligere
			snurrFart: [1.2, 2.6],
			fall: [34, 48],
			treghet: 1.4,
		},
		bjork: {
			farger: ["#d9a21b", "#e4b631", "#c98a16", "#867f17"],
			storrelse: 10,
			svingFart: [2.4, 3.4], // små blader flagrer raskere
			snurrFart: [2.2, 4.2],
			fall: [40, 58],
			treghet: 2.2,
		},
	};

	function nyttBlad() {
		const art = Math.random() < 0.45 ? "lonn" : "bjork";
		const o = BLADARTER[art];
		const storrelse = tilfeldig(0.8, 1.2);
		const fraVenstre = Math.random() < 0.7;
		return {
			type: "blad",
			art,
			x: fraVenstre ? -40 : tilfeldig(0, bredde * 0.6),
			y: fraVenstre ? tilfeldig(-20, hoyde * 0.45) : -40,
			vx: tilfeldig(20, 60),
			vy: tilfeldig(0, 20),
			radius: o.storrelse * storrelse,
			treghet: o.treghet / storrelse, // mindre blad er lettere og følger vinden tettere
			fall: tilfeldig(...o.fall) * Math.sqrt(storrelse),
			svingFase: tilfeldig(0, Math.PI * 2),
			svingFart: tilfeldig(...o.svingFart),
			svingUtslag: tilfeldig(0.5, 0.9),
			snurr: tilfeldig(0, Math.PI * 2),
			snurrFart: tilfeldig(...o.snurrFart) * (Math.random() < 0.5 ? -1 : 1),
			vinkel: tilfeldig(-Math.PI, Math.PI),
			farge: velg(o.farger),
		};
	}

	function oppdaterBlad(b, dt) {
		const v = vind(tid, b.y, 70, 45);
		b.svingFase += b.svingFart * dt;
		const cos = Math.cos(b.svingFase);
		// Glir sidelengs i svingen, synker raskt midt i svingen og nesten står stille i ytterpunktene
		b.vx = mot(b.vx, v.x + 38 * cos, b.treghet, dt);
		b.vy = mot(b.vy, b.fall * (0.25 + cos * cos) - 8 + v.y, 2.2, dt);
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		b.snurr += b.snurrFart * (0.4 + Math.abs(v.x - b.vx) / 40) * dt;
	}

	function tegnBlad(b) {
		const vipp = Math.cos(b.snurr); // -1..1, bladet vendes rundt lengdeaksen
		const form = FORMER[b.art];
		ctx.rotate(b.vinkel + b.svingUtslag * Math.sin(b.svingFase) + b.vx * 0.002);
		ctx.scale(Math.max(Math.abs(vipp), 0.08) * b.radius, b.radius);
		ctx.fillStyle = b.farge;
		ctx.globalAlpha = vipp < 0 ? 0.75 : 0.95; // baksiden er litt matt
		ctx.fill(form.flate);
		ctx.globalAlpha = 0.3;
		ctx.strokeStyle = MORK;
		ctx.lineWidth = 1 / b.radius;
		ctx.stroke(form.nerver);
	}

	// ---------- Vår: løvetannfrø og villblomster som stiger ----------

	const BLOMSTER = [
		{ form: "femblad", farge: "#e8c21c", midte: "#b8860b" }, // smørblomst
		{ form: "femblad", farge: "#4f74b8", midte: "#2c3f6b" }, // kornblomst
		{ form: "femblad", farge: "#d9708f", midte: "#8c2f4f" }, // rosa
		{ form: "femblad", farge: "#8a5aa8", midte: "#e8c21c" }, // lilla
		{ form: "prestekrage", farge: "#fbfaf2", midte: "#e8b61c" }, // prestekrage
	];

	function nyttFro() {
		const fraBunnen = Math.random() < 0.75;
		return {
			type: "fro",
			x: fraBunnen ? tilfeldig(-40, bredde * 0.75) : -30,
			y: fraBunnen ? hoyde + 30 : tilfeldig(hoyde * 0.5, hoyde),
			vx: tilfeldig(10, 30),
			vy: tilfeldig(-30, -10),
			storrelse: tilfeldig(0.8, 1.15),
			stig: tilfeldig(28, 46), // fallskjermen gjør frøet nesten vektløst
			svaiFase: tilfeldig(0, Math.PI * 2),
			svaiFart: tilfeldig(0.9, 1.5),
			snurr: tilfeldig(0, Math.PI * 2),
			snurrFart: tilfeldig(0.4, 1.0) * (Math.random() < 0.5 ? -1 : 1),
			trader: Math.round(tilfeldig(11, 15)),
		};
	}

	function nyBlomst() {
		const blomst = velg(BLOMSTER);
		const fraBunnen = Math.random() < 0.75;
		return {
			type: "blomst",
			...blomst,
			x: fraBunnen ? tilfeldig(-40, bredde * 0.75) : -30,
			y: fraBunnen ? hoyde + 30 : tilfeldig(hoyde * 0.5, hoyde),
			vx: tilfeldig(10, 40),
			vy: tilfeldig(-40, -15),
			radius: (blomst.form === "prestekrage" ? 8 : 6.5) * tilfeldig(0.85, 1.2),
			stig: tilfeldig(18, 30), // tyngre enn frøene, stiger saktere
			svingFase: tilfeldig(0, Math.PI * 2),
			svingFart: tilfeldig(1.6, 2.4),
			snurr: tilfeldig(0, Math.PI * 2),
			snurrFart: tilfeldig(1.0, 2.2) * (Math.random() < 0.5 ? -1 : 1),
			vinkel: tilfeldig(0, Math.PI * 2),
			dreieFart: tilfeldig(-0.8, 0.8),
		};
	}

	function oppdaterFro(f, dt) {
		const v = vind(tid, f.y, 30, 28);
		f.svaiFase += f.svaiFart * dt;
		// Følger lufta nesten helt, og løftes litt ekstra i vindkastene
		f.vx = mot(f.vx, v.x, 3.2, dt);
		f.vy = mot(f.vy, -f.stig - Math.max(v.x - 30, 0) * 0.25 + v.y * 0.6, 2.5, dt);
		f.x += f.vx * dt;
		f.y += f.vy * dt;
		f.snurr += f.snurrFart * dt;
	}

	function tegnFro(f) {
		// Frøet henger under fallskjermen og lener seg med vinden
		const lening = Math.atan2(f.vx, 60) * 0.6 + 0.12 * Math.sin(f.svaiFase);
		ctx.rotate(lening);
		ctx.scale(f.storrelse, f.storrelse);

		ctx.strokeStyle = "#8f8a6e";
		ctx.lineWidth = 0.6;
		ctx.globalAlpha = 0.9;
		// Stilken
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(0, 13);
		ctx.stroke();
		// Frøet
		ctx.fillStyle = "#6b4a1e";
		ctx.beginPath();
		ctx.ellipse(0, 15, 0.9, 2.4, 0, 0, Math.PI * 2);
		ctx.fill();
		// Fallskjermen: tynne tråder i en vifte, som dreier sakte rundt
		const flat = 0.55 + 0.45 * Math.abs(Math.cos(f.snurr));
		ctx.globalAlpha = 0.75;
		ctx.beginPath();
		for (let i = 0; i < f.trader; i++) {
			const v = -Math.PI / 2 + ((i / (f.trader - 1)) - 0.5) * 2.6;
			const ex = Math.cos(v) * 8 * flat;
			const ey = Math.sin(v) * 7;
			ctx.moveTo(0, 0);
			ctx.lineTo(ex, ey);
		}
		ctx.stroke();
		ctx.fillStyle = "#8f8a6e";
		for (let i = 0; i < f.trader; i++) {
			const v = -Math.PI / 2 + ((i / (f.trader - 1)) - 0.5) * 2.6;
			ctx.beginPath();
			ctx.arc(Math.cos(v) * 8 * flat, Math.sin(v) * 7, 0.7, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function oppdaterBlomst(b, dt) {
		const v = vind(tid, b.y, 35, 30);
		b.svingFase += b.svingFart * dt;
		const cos = Math.cos(b.svingFase);
		b.vx = mot(b.vx, v.x + 18 * cos, 1.6, dt);
		b.vy = mot(b.vy, -b.stig * (0.6 + 0.7 * cos * cos) + v.y, 2, dt);
		b.x += b.vx * dt;
		b.y += b.vy * dt;
		b.snurr += b.snurrFart * (0.5 + Math.abs(v.x - b.vx) / 40) * dt;
		b.vinkel += b.dreieFart * dt;
	}

	function tegnBlomst(b) {
		const vipp = Math.cos(b.snurr);
		const form = FORMER[b.form];
		ctx.rotate(0.5 * Math.sin(b.svingFase));
		ctx.scale(b.radius, Math.max(Math.abs(vipp), 0.12) * b.radius);
		ctx.rotate(b.vinkel);
		ctx.globalAlpha = vipp < 0 ? 0.8 : 0.95;
		ctx.fillStyle = b.farge;
		ctx.fill(form.kronblader);
		if (b.form === "prestekrage") {
			// Hvite kronblader trenger en tynn kant for å synes på den lyse bakgrunnen
			ctx.strokeStyle = "#b8b39a";
			ctx.lineWidth = 0.8 / b.radius;
			ctx.stroke(form.kronblader);
		}
		ctx.fillStyle = b.midte;
		ctx.fill(form.midte);
	}

	// ---------- Oppsett per stemning ----------

	const STEMNINGER = {
		host: { maks: 4, intervall: [2, 5.5], lag: nyttBlad },
		var: { maks: 6, intervall: [1.2, 3.5], lag: () => (Math.random() < 0.6 ? nyttFro() : nyBlomst()) },
	};

	const TYPER = {
		blad: { oppdater: oppdaterBlad, tegn: tegnBlad },
		fro: { oppdater: oppdaterFro, tegn: tegnFro },
		blomst: { oppdater: oppdaterBlomst, tegn: tegnBlomst },
	};

	const erPaSkjermen = (s) => s.x > -80 && s.x < bredde + 80 && s.y > -80 && s.y < hoyde + 80;

	// ---------- Blås på noe ----------

	// Et pust er et kort vindkast, ikke et dytt: det bygger seg mykt opp og dør ut
	// igjen, og retningen svinger litt underveis med små virvler, så banen blir buet.
	//  kraft  – hvor hardt pustet drar (piksler/s²) på det sterkeste
	//  brems  – luftmotstanden som bremser tingen når pustet slipper
	const PUST = {
		lonn: { kraft: 1250, brems: 2.4 },
		bjork: { kraft: 1450, brems: 2.6 },
		fro: { kraft: 1700, brems: 3.0 },
		blomst: { kraft: 1350, brems: 2.5 },
	};

	const pustFor = (s) => PUST[s.type === "blad" ? s.art : s.type];
	const treffRadius = (s) => Math.max((s.radius ?? 12) * 1.4, 16);

	let blasteSist = 0;

	function blas(hendelse) {
		if (!svevere.length) return;
		const { clientX: x, clientY: y } = hendelse;
		let truffet = null;
		let nermest = Infinity;
		for (const s of svevere) {
			// Frøet sitt midtpunkt er litt under fallskjermen
			const avstand = Math.hypot(s.x - x, s.y + (s.type === "fro" ? 6 : 0) - y);
			if (avstand < treffRadius(s) && avstand < nermest) {
				truffet = s;
				nermest = avstand;
			}
		}
		if (!truffet) return;

		truffet.pust = {
			t: 0,
			varighet: tilfeldig(0.55, 0.8),
			retning: tilfeldig(0, Math.PI * 2),
			krumning: tilfeldig(0.8, 1.8) * (Math.random() < 0.5 ? -1 : 1), // hvor mye banen svinger
			virvelFase: tilfeldig(0, Math.PI * 2),
			styrke: tilfeldig(0.85, 1.15),
			snurr: tilfeldig(5, 9) * (Math.random() < 0.5 ? -1 : 1),
		};
		truffet.pustX ??= 0;
		truffet.pustY ??= 0;
		blasteSist = performance.now();
		hendelse.preventDefault();
	}

	// Pustet kommer på toppen av vanlig bevegelse
	function oppdaterPust(s, dt) {
		if (!s.pust && !s.pustX && !s.pustY) return;
		const { kraft, brems } = pustFor(s);
		const demping = Math.exp(-brems * dt);
		s.pustX *= demping;
		s.pustY *= demping;

		const p = s.pust;
		if (p) {
			p.t += dt;
			const andel = Math.min(p.t / p.varighet, 1);
			const kurve = Math.sin(Math.PI * andel) ** 2; // mykt opp, mykt ned
			const retning = p.retning + p.krumning * p.t + 0.35 * Math.sin(p.t * 11 + p.virvelFase);
			const a = kraft * p.styrke * kurve;
			s.pustX += Math.cos(retning) * a * dt;
			s.pustY += Math.sin(retning) * a * dt;
			s.snurr += p.snurr * kurve * dt;
			if (andel >= 1) s.pust = null;
		}

		s.x += s.pustX * dt;
		s.y += s.pustY * dt;
		if (!s.pust && Math.hypot(s.pustX, s.pustY) < 2) s.pustX = s.pustY = 0;
	}

	addEventListener("pointerdown", blas);
	// Et klikk som traff noe, skal ikke også åpne lenker eller lukke saken under
	addEventListener(
		"click",
		(hendelse) => {
			if (performance.now() - blasteSist < 600) {
				hendelse.preventDefault();
				hendelse.stopPropagation();
				blasteSist = 0;
			}
		},
		true
	);

	// ---------- Animasjonen ----------

	function lagLerret() {
		lerret = document.createElement("canvas");
		lerret.className = "stemning";
		lerret.setAttribute("aria-hidden", "true");
		document.body.append(lerret);
		ctx = lerret.getContext("2d");
		tilpass();
		addEventListener("resize", tilpass);
	}

	function tilpass() {
		skala = Math.min(devicePixelRatio || 1, 2);
		bredde = innerWidth;
		hoyde = innerHeight;
		lerret.width = bredde * skala;
		lerret.height = hoyde * skala;
	}

	function steg(naa) {
		const dt = Math.min((naa - forrige) / 1000, 0.05);
		forrige = naa;
		tid += dt;

		for (const navn of aktive) {
			const stemning = STEMNINGER[navn];
			const antall = svevere.filter((s) => s.stemning === navn).length;
			if (tid >= nesteTid[navn] && antall < stemning.maks) {
				svevere.push({ ...stemning.lag(), stemning: navn });
				nesteTid[navn] = tid + tilfeldig(...stemning.intervall);
			}
		}

		ctx.setTransform(skala, 0, 0, skala, 0, 0);
		ctx.clearRect(0, 0, bredde, hoyde);
		for (const s of svevere) {
			const type = TYPER[s.type];
			type.oppdater(s, dt);
			oppdaterPust(s, dt);
			ctx.save();
			ctx.translate(s.x, s.y);
			type.tegn(s);
			ctx.restore();
		}
		// Nye ting starter like utenfor kanten, så de får litt tid før de fjernes
		svevere = svevere.filter((s) => erPaSkjermen(s) || (s.alder = (s.alder ?? 0) + dt) < 3);

		if (aktive.size || svevere.length) {
			requestAnimationFrame(steg);
		} else {
			animerer = false;
		}
	}

	function oppdaterTilstand() {
		const apne = new Set([...saker].filter((sak) => sak.open).map((sak) => sak.dataset.stemning));
		for (const navn of apne) {
			if (!STEMNINGER[navn] || aktive.has(navn)) continue;
			aktive.add(navn);
			nesteTid[navn] = tid + 0.3;
		}
		// Det som allerede er ute når en sak lukkes, får blåse ferdig
		for (const navn of aktive) if (!apne.has(navn)) aktive.delete(navn);

		if (aktive.size && !animerer) {
			if (!lerret) lagLerret();
			animerer = true;
			forrige = performance.now();
			requestAnimationFrame(steg);
		}
	}

	saker.forEach((sak) => sak.addEventListener("toggle", oppdaterTilstand));
	oppdaterTilstand();
})();
