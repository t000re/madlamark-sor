// Gir CSS beskjed om hvor høy toppen er, så tittelen kan legge seg rett under den
// når begge står fast på mobil. Høyden endrer seg hvis menyen brytes over flere linjer.
(() => {
	const topp = document.querySelector(".topp");
	if (!topp) return;
	const oppdater = () => document.documentElement.style.setProperty("--topp-hoyde", `${topp.offsetHeight}px`);
	new ResizeObserver(oppdater).observe(topp);
	oppdater();
})();
