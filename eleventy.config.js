import fs from "node:fs";
import { HtmlBasePlugin } from "@11ty/eleventy";
import { iDag, isoDato, norskDato, sisteVisningsdag } from "./lib/dato.js";

const nettsted = JSON.parse(fs.readFileSync("innhold/_data/nettsted.json", "utf8"));

export default function (eleventyConfig) {
	// Legger til riktig adresse-prefiks når siden ligger på f.eks. GitHub Pages
	eleventyConfig.addPlugin(HtmlBasePlugin);

	eleventyConfig.addPassthroughCopy("innhold/filer");
	eleventyConfig.addPassthroughCopy("innhold/stil");
	eleventyConfig.addPassthroughCopy("innhold/skript");

	// Vanlige linjeskift i markdown blir linjeskift på siden, og nettadresser blir lenker
	eleventyConfig.amendLibrary("md", (md) => {
		md.set({ breaks: true, linkify: true });
		// Bilder lastes først når man ruller ned til dem
		const vanlig = md.renderer.rules.image;
		md.renderer.rules.image = (tokens, idx, options, env, self) => {
			tokens[idx].attrSet("loading", "lazy");
			tokens[idx].attrSet("decoding", "async");
			return vanlig(tokens, idx, options, env, self);
		};
	});

	// En overskrift helt øverst i dokumentet (# Tittel) brukes som tittel, ikke som innhold
	eleventyConfig.addPreprocessor("fjern-tittel", "md", (data, innhold) => {
		return innhold.replace(/^\s*#[ \t]+.+\n?/, "");
	});

	// Én samling per menypunkt, sortert enten etter dato (nyeste først) eller rekkefølge
	for (const seksjon of nettsted.meny) {
		eleventyConfig.addCollection(seksjon.mappe, (api) => {
			const sider = api.getFilteredByGlob(`innhold/${seksjon.mappe}/**/*.md`);
			if (seksjon.sortering === "dato") {
				return sider.sort((a, b) => (b.data.dato ?? 0) - (a.data.dato ?? 0));
			}
			return sider.sort(
				(a, b) =>
					(a.data.rekkefolge ?? 999) - (b.data.rekkefolge ?? 999) ||
					a.data.title.localeCompare(b.data.title, "nb")
			);
		});
	}

	// Aktuelt: bare saker som ikke er utløpt, den nærmeste først
	eleventyConfig.addCollection("aktuelt", (api) =>
		api
			.getFilteredByGlob("innhold/aktuelt/*.md")
			.filter((sak) => !erUtlopt(sak.data))
			.sort((a, b) => (a.data.dato ?? 0) - (b.data.dato ?? 0))
	);

	eleventyConfig.addFilter("norskDato", norskDato);

	// Deler en liste med sider opp etter år, nyeste år først. Sider med «gruppe» (f.eks. alt i
	// mappen tidligere-arsmoter) samles i en egen gruppe med det navnet, etter årene.
	eleventyConfig.addFilter("grupperPaAar", (sider, aktivUrl) => {
		const iAar = Number(iDag().slice(0, 4));
		const grupper = new Map();
		for (const side of sider) {
			const navn = side.data.gruppe || (side.data.dato ? side.data.dato.getUTCFullYear() : iAar);
			if (!grupper.has(navn)) grupper.set(navn, []);
			grupper.get(navn).push(side);
		}
		const erAar = (navn) => typeof navn === "number";
		return [...grupper]
			.sort(([a], [b]) => (erAar(a) && erAar(b) ? b - a : erAar(a) ? -1 : erAar(b) ? 1 : 0))
			.map(([navn, sider]) => ({
				aar: navn,
				sider,
				aktiv: sider.some((side) => side.url === aktivUrl),
			}));
	});

	eleventyConfig.addFilter("seksjonsoppsett", (mappe) => nettsted.meny.find((punkt) => punkt.mappe === mappe));

	return {
		dir: {
			input: "innhold",
			includes: "_maler",
			data: "_data",
			output: "_site",
		},
		// Markdown-filer skal bare være markdown, så krøllparenteser o.l. ikke skaper trøbbel
		markdownTemplateEngine: false,
		htmlTemplateEngine: "njk",
	};
}

function erUtlopt(data) {
	const sisteDag = sisteVisningsdag(data);
	return sisteDag ? isoDato(sisteDag) < iDag() : false;
}
