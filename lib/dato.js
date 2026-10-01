// Gjør om en dato fra front matter (Date eller "2026-10-31") til Date
export function tilDato(verdi) {
	if (!verdi) return null;
	const dato = verdi instanceof Date ? verdi : new Date(String(verdi).trim());
	return isNaN(dato) ? null : dato;
}

// "2026-10-31"
export function isoDato(dato) {
	return dato.toISOString().slice(0, 10);
}

// Dagens dato i Norge, som "2026-10-01"
export function iDag() {
	return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(new Date());
}

// "31. oktober", eller "31. oktober 2027" hvis det ikke er i år
export function norskDato(dato, medAar = false) {
	dato = tilDato(dato);
	if (!dato) return "";
	const visAar = medAar || dato.getUTCFullYear() !== Number(iDag().slice(0, 4));
	return new Intl.DateTimeFormat("nb-NO", {
		day: "numeric",
		month: "long",
		year: visAar ? "numeric" : undefined,
		timeZone: "UTC",
	}).format(dato);
}

// Siste dag en aktuelt-sak skal vises: «vis_til» hvis den er satt, ellers datoen
export function sisteVisningsdag(data) {
	return tilDato(data.vis_til) ?? tilDato(data.dato);
}
