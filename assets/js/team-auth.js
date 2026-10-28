/* Shared account switching for the website admin and weekly planner. */
window.LPCTeamAuth = Object.freeze({
  landing(actor) {
    if (actor?.admin) return { href: "#/lpcadmin", label: "Main admin menu", view: "my-week" };
    if (actor?.manage?.includes("ministry")) return { href: "#/volunteers?view=pastoral", label: "Pastoral Planner", view: "pastoral" };
    if (actor?.manage?.includes("service")) return { href: "#/volunteers?view=choir", label: "Choir & Media", view: "choir" };
    if (actor) return { href: "#/volunteers?view=my-week", label: "My Week", view: "my-week" };
    return { href: "#/home", label: "Website home", view: "my-week" };
  },
  navigation(actor, planner = false) {
    const home = this.landing(actor);
    return `<nav class="landing-navigation" aria-label="Return navigation"><a href="${home.href}"${planner && actor && !actor.admin ? ' data-vs="landing"' : ''}>← ${home.label}</a></nav>`;
  },
  async signOut() {
    for (const path of ["/api/volunteers/logout", "/api/admin/logout"]) {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Unable to sign out. Please try again.");
    }

    const response = await fetch("/api/volunteers/session", { cache: "no-store" });
    if (!response.ok || (await response.json()).actor) {
      throw new Error("Sign-out did not complete. Please try again.");
    }
    window.location.hash = "#/volunteers";
    window.location.reload();
  },
});
