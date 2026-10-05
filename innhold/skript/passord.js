// Enkel passordsperre for en del av nettsiden. Passordet sammenlignes med et
// fingeravtrykk (SHA-256), så det står ikke i klartekst i koden. Når det er riktig,
// huskes det i nettleseren, så man slipper å skrive det på hver side.
(() => {
	const skjema = document.querySelector(".passord-boks");
	if (!skjema) return;
	const nokkel = `laast-opp-${skjema.dataset.seksjon}`;
	const feil = skjema.querySelector(".passord-feil");

	async function fingeravtrykk(tekst) {
		const data = new TextEncoder().encode(tekst.trim().toLowerCase());
		const hash = await crypto.subtle.digest("SHA-256", data);
		return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
	}

	skjema.addEventListener("submit", async (hendelse) => {
		hendelse.preventDefault();
		const felt = skjema.querySelector("input");
		if ((await fingeravtrykk(felt.value)) === skjema.dataset.hash) {
			try { localStorage.setItem(nokkel, skjema.dataset.hash); } catch {}
			document.documentElement.classList.remove("laast");
		} else {
			feil.hidden = false;
			felt.select();
		}
	});

	if (document.documentElement.classList.contains("laast")) skjema.querySelector("input").focus({ preventScroll: true });
})();
