import fs from "node:fs";
import path from "node:path";
import { tilDato } from "../../lib/dato.js";

// Regler som gjør at en markdown-fil blir en side uten at man trenger å fylle ut noe:
// - tittel: «tittel» i toppen av filen, ellers første overskrift (# …), ellers filnavnet
// - dato: «dato» i toppen av filen, ellers dato først i filnavnet (2026-03-16-styremote.md),
//   ellers «date» i toppen av filen
// - adresse: /mappe/filnavn/
export default {
	title: (data) => data.title || data.tittel || tittelFraFil(data.page),

	dato: (data) => tilDato(data.dato) ?? datoFraFilnavn(data.page) ?? tilDato(data.date),

	// En side i en undermappe (praktisk-informasjon/plantegninger-over-hus-og-tilbygg/uteomrader.md) hører
	// under siden med samme navn som mappen, og vises rykket inn under den i undermenyen
	forelder: (data) => {
		if (!erInnholdsfil(data.page)) return null;
		const deler = innholdssti(data.page).split("/");
		return deler.length === 3 ? deler[1] : null;
	},

	seksjon: (data) => (erInnholdsfil(data.page) ? innholdssti(data.page).split("/")[0] : null),

	permalink: (data) => {
		if (data.permalink || !erInnholdsfil(data.page)) return data.permalink;
		// «kun_meny: true» gir bare en overskrift i undermenyen, ingen egen side
		if (data.kun_meny) return false;
		const [mappe, ...resten] = innholdssti(data.page).split("/");
		// Aktuelt-saker får ikke egen side, de vises på forsiden
		if (mappe === "aktuelt") return false;
		return `/${mappe}/${resten.map(lagSlug).join("/")}/`;
	},
};

function erInnholdsfil(page) {
	return page.inputPath.endsWith(".md") && innholdssti(page).includes("/");
}

// "referater/2026-03-16-styremote" for ./innhold/referater/2026-03-16-styremote.md
function innholdssti(page) {
	return page.inputPath.replace(/^\.?\/?innhold\//, "").replace(/\.md$/, "");
}

function tittelFraFil(page) {
	if (!page.inputPath.endsWith(".md")) return "";
	const tekst = fs.readFileSync(page.inputPath, "utf8").replace(/^---[\s\S]*?\n---\s*\n/, "");
	const overskrift = tekst.match(/^\s*#[ \t]+(.+)/);
	if (overskrift) return overskrift[1].replace(/[#\s]+$/, "").trim();
	const navn = path.basename(page.inputPath, ".md").replace(/^\d{4}-\d{2}-\d{2}[-_ ]*/, "").replace(/[-_]+/g, " ");
	return navn.charAt(0).toUpperCase() + navn.slice(1);
}

function datoFraFilnavn(page) {
	const treff = path.basename(page.inputPath).match(/^(\d{4}-\d{2}-\d{2})/);
	return treff ? tilDato(treff[1]) : null;
}

function lagSlug(tekst) {
	return tekst
		.toLowerCase()
		.replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
		.normalize("NFD").replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
