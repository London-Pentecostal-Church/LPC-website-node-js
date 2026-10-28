let pageImages = {};
let branchCards = [];

let branchConfig = { branches: {} };
function applyBranchConfig(config) {
  branchConfig = config;
  branchCards = Object.entries(config.branches).map(([slug, b]) => ({
    ...b,
    slug,
    wordmark: [b.name, "Pentecostal", "Church"],
    dark: b.color,
    mid: b.color,
    accent: "#f4bd3e",
    soft: "#f4f6fa",
  }));
  const pageKeys = new Set([
    "plan-your-visit",
    "ministries",
    "youth",
    "branches",
    "about",
    "pastors",
    "watch",
    "contact",
  ]);
  for (const key of Object.keys(heroImageDefaults))
    if (!pageKeys.has(key)) delete heroImageDefaults[key];
  for (const branch of branchCards)
    heroImageDefaults[branch.slug] = {
      video: "",
      desktopImage: branch.image || "",
      mobileImage: "",
      desktopFocal: "center",
      mobileFocal: "center",
      desktopScale: "1",
      mobileScale: "1",
      desktopFit: "cover",
      mobileFit: "cover",
    };
}
const defaultTheme = {
  logo: "./assets/images/brand/normalized/lpc-logo.png",
  primary: "#8F0F14",
  mid: "#6F0C10",
  dark: "#4F080B",
  accent: "#f4bd3e",
  soft: "#fff0ec",
};

const defaultHomeHeroConfig = {
  video: "./assets/videos/LPC_30s.mp4",
  poster: "./assets/images/derived/hero-crowd-plain.jpg",
  focal: "center 42%",
  mobileFocal: "center 38%",
  scale: "1",
  mobileScale: "1",
  fit: "cover",
  mobileFit: "cover",
  label: "Regular church events",
  title: "LPC worship, baptism, prayer, and fellowship",
};

const homeHeroStorageKey = "LPC_HOME_HERO_CONFIG";
let serverHomeHeroConfig = null;
let serverHeroImagesConfig = {};
let adminSession = { authenticated: false };
let pastorThoughtConfig = null;
let siteSettingsConfig = null;

const defaultSiteSettingsConfig = {
  topbarSlogan: "Celebrating 25 Years of God's Faithfulness",
};

const defaultPastorThoughtConfig = {
  kicker: "Pastor's Thought",
  title: "A word of encouragement for this week.",
  author: "LPC Pastoral Team",
  date: "",
  body: "Use this space to share a short pastoral reflection, Scripture encouragement, or thought connected to the messages and worship life of the church.",
  ctaText: "Watch Sermons",
  ctaHref: "#/watch",
};

const heroImageDefaults = {
  "plan-your-visit": {
    video: "",
    desktopImage: "./assets/images/derived/plan-visit-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  ministries: {
    video: "",
    desktopImage: "./assets/images/derived/branches-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  youth: {
    video: "",
    desktopImage: "./assets/images/derived/youth-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  branches: {
    video: "",
    desktopImage: "./assets/images/derived/branches-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  about: {
    video: "",
    desktopImage: "./assets/images/derived/branches-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  pastors: {
    video: "",
    desktopImage: "./assets/images/derived/pastors-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  watch: {
    video: "",
    desktopImage: "./assets/images/derived/watch-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  contact: {
    video: "",
    desktopImage: "./assets/images/derived/contact-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  chelmsford: {
    video: "",
    desktopImage: "./assets/images/derived/branch-chelmsford-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  harlow: {
    video: "",
    desktopImage: "./assets/images/derived/welcome-crowd.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  basildon: {
    video: "",
    desktopImage: "./assets/images/derived/branch-basildon-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
  "south-london": {
    video: "",
    desktopImage: "./assets/images/derived/branch-south-london-hero.jpg",
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  },
};

const mediaSources = {
  home: {
    title: "LPC Main Church Media",
    watchTitle: "Watch LPC online",
    youtubeHandle: "@LondonPentecostalChurch",
    youtubeUrl: "https://www.youtube.com/c/londonpentecostalchurch",
    socials: [
      [
        "Facebook",
        "https://www.facebook.com/lpcchurchlondon/",
        "News, photos & events",
      ],
      [
        "Instagram",
        "https://www.instagram.com/londonpentecostalchurch/",
        "Photos from church life",
      ],
      [
        "YouTube",
        "https://www.youtube.com/c/londonpentecostalchurch",
        "Live streams & sermons",
      ],
    ],
  },
  basildon: {
    title: "Basildon Media Collection",
    watchTitle: "Watch Basildon online",
    youtubeHandle: "@BasildonPentecostalChurch",
    youtubeUrl: "https://www.youtube.com/@BasildonPentecostalChurch/streams",
    socials: [
      [
        "Facebook",
        "https://www.facebook.com/basildonpentecostalchurch/",
        "News, photos & events",
      ],
      [
        "YouTube",
        "https://www.youtube.com/@BasildonPentecostalChurch/streams",
        "Live streams & sermons",
      ],
    ],
  },
  chelmsford: {
    title: "Chelmsford Media Collection",
    watchTitle: "Watch CPC online",
    youtubeHandle: "@ChelmsfordPentecostalChurch",
    youtubeUrl: "https://www.youtube.com/@ChelmsfordPentecostalChurch",
    socials: [
      [
        "Facebook",
        "https://www.facebook.com/cpcchurchlpc/?locale=en_GB",
        "News, photos & events",
      ],
      [
        "Instagram",
        "https://www.instagram.com/cpcchurchuk/",
        "Photos from church life",
      ],
      [
        "YouTube",
        "https://www.youtube.com/@ChelmsfordPentecostalChurch",
        "Live streams & sermons",
      ],
    ],
  },
  harlow: {
    title: "Harlow Media Collection",
    watchTitle: "Harlow branch media",
    socials: [
      [
        "Facebook",
        "https://www.facebook.com/hpcchurchlpc/?locale=en_GB",
        "News, photos & events",
      ],
    ],
  },
  "south-london": {
    title: "South London Media Collection",
    watchTitle: "Watch SLPC online",
    youtubeHandle: "@SouthLondonPentecostalChurch",
    youtubeUrl: "https://www.youtube.com/@SouthLondonPentecostalChurch",
    socials: [
      [
        "YouTube",
        "https://www.youtube.com/@SouthLondonPentecostalChurch",
        "Live streams & sermons",
      ],
    ],
  },
};

let pastors = [
  {
    name: "Pr Sam John",
    role: "President & Senior Minister",
    image: "./assets/images/team/sam-john-hero.png",
  },
  {
    name: "Pr Binoy Jose",
    role: "Associate Pastor",
    image: "./assets/images/team/Binoy.png",
  },
  {
    name: "Pr Tiju Thomas",
    role: "Associate / Youth Pastor",
    image: "./assets/images/team/Tiju.png",
  },
  {
    name: "Pr Joseph Varghese",
    role: "Associate Pastor",
    image: "./assets/images/team/Joseph.png",
  },
  {
    name: "Pr Eugene Skaria",
    role: "Associate Pastor",
    image: "./assets/images/team/Eugene.png",
  },
];

const seniorPastor = pastors[0];
let pastorConfig = {
  people: {
    "pastor-1": {
      name: "Pr Binoy Jose",
      role: "Associate Pastor",
      image: "./assets/images/team/binoy-jose.jpg",
      intro: "",
    },
    "pastor-2": {
      name: "Pr Tiju Thomas",
      role: "Associate / Youth Pastor",
      image: "./assets/images/team/tiju-thomas.jpg",
      intro: "",
    },
    "pastor-3": {
      name: "Pr Joseph Varghese",
      role: "Associate Pastor",
      image: "./assets/images/team/joseph-varghese.jpg",
      intro: "",
    },
    "pastor-4": {
      name: "Pr Eugene Skaria",
      role: "Associate Pastor",
      image: "./assets/images/team/eugene-skaria.jpg",
      intro: "",
    },
  },
};
function applyPastorConfig(config) {
  pastorConfig = config;
  pastors = [
    seniorPastor,
    ...Object.entries(config.people).map(([id, p]) => ({ ...p, id })),
  ];
}
applyPastorConfig(pastorConfig);

const routes = {
  "/home": renderHome,
  "/": renderHome,
  "/plan-your-visit": () =>
    renderSubPage({
      pageKey: "plan-your-visit",
      label: "Plan Your Visit",
      title: "Know what to expect when you visit LPC.",
      copy: "Join us for prayer, worship, the Word, and church family across our branches. Whether this is your first Sunday or you are returning, we want your visit to feel clear, warm, and welcoming.",
      image: "./assets/images/derived/plan-visit-hero.jpg",
      actions: [
        ["Find a Branch", "#/branches", "btn--gold"],
        ["Watch Online", "#/watch", "btn--outline"],
      ],
      body: `
        <section class="section section--tight section--swoosh">
          <div class="container grid-two">
            <article class="cards-banner">
              <p class="section-label">What To Expect</p>
              <h2 class="cards-banner__title">A Sunday centred on worship, prayer, and the Word.</h2>
              <p class="cards-banner__copy">Our Sunday services begin at 10:30 AM. Expect passionate worship, Bible teaching, family connection, and ministry for all ages.</p>
              <ul class="feature-list" style="margin-top:20px">
                <li>Friendly welcome team and clear arrival guidance</li>
                <li>Prayer and ministry time during the service</li>
                <li>Sunday School and youth connection across branches</li>
                <li>Online sermon access if you cannot attend in person</li>
              </ul>
            </article>
            <div class="content-stack">
              ${card("Service Times", "Sunday Worship - 10:30 AM<br>Wednesday Prayer - 7:30 PM<br>Youth Service - Friday 7:00 PM")}
              ${card("Need directions?", "Use the branch directory to choose the nearest LPC location and plan your route before Sunday.")}
              ${card("First time at LPC", "If it helps, come a few minutes early. Our team can help with seating, children, and any questions about the service.")}
            </div>
          </div>
        </section>
        ${renderBranchesSection(true)}
      `,
    }),
  "/ministries": () =>
    renderSubPage({
      pageKey: "ministries",
      label: "Ministries",
      title: "Helping every generation grow in faith.",
      copy: "LPC is built around worship, discipleship, community life, youth development, and service. Our ministries are designed to help people belong, grow, and serve with confidence.",
      image: "./assets/images/derived/branches-hero.jpg",
      actions: [["Explore Youth", "#/youth", "btn--gold"]],
      body: `
        <section class="section section--tight section--swoosh">
          <div class="container">
            <div class="cards-grid">
              ${infoCard("Food Bank", "Supporting our local community with nutritious meals and resources.", "utensils")}
              ${infoCard("Sunday School", "Biblical foundation for children and young families across our branches.", "book")}
              ${infoCard("Christ Envoys Youth Ministry", "A Christ-centred ministry shaping the next generation.", "users")}
              ${infoCard("Women in Christ", "LPC Women’s Group nurtures Christian growth, strengthens friendships, and builds a supportive community through faith, fellowship, laughter, and shared experiences.", "play")}
            </div>
          </div>
        </section>
      `,
    }),
  "/youth": () =>
    renderSubPage({
      pageKey: "youth",
      label: "LPC Youth",
      title: "A generation built in faith, truth, and purpose.",
      copy: "LPC Youth creates space for teenagers and young adults to worship, learn Scripture, form friendships, and grow into bold disciples of Christ.",
      image: "./assets/images/derived/youth-hero.jpg",
      actions: [
        ["Join This Friday", "#/contact", "btn--gold"],
        ["Watch Sermons", "#/watch", "btn--outline"],
      ],
      body: `
        <section class="section section--tight section--swoosh">
          <div class="container grid-two">
            <div class="content-stack">
              ${card("Youth Service", "Friday - 7:00 PM<br>Worship, teaching, and prayer for young people")}
              ${card("Discipleship Focus", "Bible study, mentoring, fellowship, and leadership development")}
            </div>
            <article class="cards-banner">
              <p class="section-label">What Happens</p>
              <h2 class="cards-banner__title">A ministry designed for real faith and real community.</h2>
              <p class="cards-banner__copy">Young people need more than events. They need belonging, truth, and leaders who will walk with them. LPC Youth is built to do exactly that.</p>
              <ul class="feature-list" style="margin-top:20px">
                <li>Friday youth gatherings</li>
                <li>Worship and prayer culture</li>
                <li>Scripture-driven teaching</li>
                <li>Branch-wide connection and friendship</li>
              </ul>
            </article>
          </div>
        </section>
      `,
    }),
  "/branches": () =>
    renderSubPage({
      pageKey: "branches",
      label: "Branches",
      title: "A church family across London and Essex.",
      copy: "Every LPC branch shares the same worship heartbeat, biblical teaching, and family culture while serving its local community faithfully.",
      image: "./assets/images/derived/branches-hero.jpg",
      actions: [["Plan Your Visit", "#/plan-your-visit", "btn--gold"]],
      body: renderBranchesSection(true),
    }),
  "/about": () =>
    renderSubPage({
      pageKey: "about",
      label: "About Us",
      title: "Welcome to London Pentecostal Church.",
      copy: "Building a spiritual house for spiritual sacrifices across London and Essex.",
      image: "./assets/images/derived/branches-hero.jpg",
      actions: [["Meet Our Team", "#/pastors", "btn--gold"]],
      body: `
        <section class="section section--tight section--about">
          <div class="container about-layout">
            <div class="about-copy">
              <p class="section-label">About Us</p>
              <h2 class="section-title">Welcome to London Pentecostal Church</h2>
              <p>Thank you for taking time to find out more about who we are. As a church we are all about knowing Jesus Christ and making Him known. Our desire is to spread the Word of God, so that we can transform our city, this nation and even the world.</p>
              <p>We are a community of people who are from all walks of life and who are at different stages in their relationships with God. LPC is a blend of new believers and established Christians. Most importantly we are a people hungry for more of God in our lives.</p>
              <p>If you are looking for a place to connect with God and to connect with His people, this is the place for you. We are looking forward to meeting you.</p>
              <p><strong>With love and thanks,<br>Pr Sam John<br>Pastor and Founder</strong></p>
            </div>
          </div>
        </section>
        <section class="section section--tight">
          <div class="container vision-grid">
            <article class="vision-card vision-card--teal">
              <h3>Our Vision</h3>
              <p>Building a spiritual house for spiritual sacrifices.</p>
              <a href="#/pastors">Meet Our Team</a>
            </article>
            <article class="vision-card vision-card--gold">
              <h3>Our Mission</h3>
              <p>We are a community of people from all walks of life, growing together in relationship with God, welcoming new believers and established Christians, and seeking more of God in our lives.</p>
              <a href="#/contact">Contact Us</a>
            </article>
          </div>
        </section>
      `,
    }),
  "/pastors": () =>
    renderSubPage({
      pageKey: "pastors",
      label: "Meet Our Team",
      title: "Pastors and ministers serving LPC.",
      copy: "Meet the pastors and ministers serving the LPC family across every branch.",
      image: "./assets/images/derived/pastors-hero.jpg",
      actions: [
        ["About LPC", "#/about", "btn--gold"],
        ["Contact Us", "#/contact", "btn--outline"],
      ],
      body: `
        <section class="section section--tight section--team">
          <div class="container">
            <div class="section-heading">
              <p class="section-label">Our Leadership Team</p>
              <h2 class="section-title">Meet Our Team</h2>
            </div>
            <div class="team-grid">
            ${pastors
              .map(
                (pastor) => `
                  <article class="team-card">
                    ${pastor.id ? `<a href="#/pastors/${encodeURIComponent(pastor.id)}" aria-label="Read about ${escapeAttribute(pastor.name)}">` : ""}${pastor.image ? `<img src="${escapeAttribute(pastor.image)}" alt="${escapeAttribute(pastor.name)}">` : `<div class="pastor-photo-empty">${icon("users")}</div>`}${pastor.id ? "</a>" : ""}
                    <div>
                      <h3>${pastor.id ? `<a href="#/pastors/${encodeURIComponent(pastor.id)}">${escapeHtml(pastor.name)}</a>` : escapeHtml(pastor.name)}</h3>
                      <p>${escapeHtml(pastor.role)}</p>${pastor.id ? `<a href="#/pastors/${encodeURIComponent(pastor.id)}">Read introduction</a>` : ""}
                    </div>
                  </article>
                `,
              )
              .join("")}
            </div>
          </div>
        </section>
      `,
    }),
  "/watch": () =>
    renderSubPage({
      pageKey: "watch",
      label: getPastorThoughtConfig().kicker,
      title: getPastorThoughtConfig().title,
      copy: renderPastorThoughtCopy(),
      image: "./assets/images/derived/watch-hero.jpg",
      actions: [
        [
          getPastorThoughtConfig().ctaText,
          getPastorThoughtConfig().ctaHref,
          "btn--gold",
        ],
        ["Plan Your Visit", "#/plan-your-visit", "btn--outline"],
      ],
      body: renderWatchHub(),
    }),
  "/admin": renderAdminPanel,
  "/admin/home-hero": renderAdminPanel,
  "/lpcadmin": renderAdminPanel,
  "/contact": () =>
    renderSubPage({
      pageKey: "contact",
      label: "Contact",
      title: "Reach out to the LPC family.",
      copy: "Whether you have a question, prayer request, or you're planning your first visit, we'd be glad to hear from you.",
      image: "./assets/images/derived/contact-hero.jpg",
      body: `
        <section class="section section--tight">
          <div class="container grid-two">
            <div class="content-stack">
              ${card("Phone", "020 8690 0701")}
              ${card("Email", "info@lpc.org.uk")}
              ${card("Main Address", "Oasis Centre, Essex Rd, Romford RM6 4JA")}
            </div>
            <article class="contact-card">
              <h3>Send a message</h3>
              <form class="contact-form">
                <label>Name<input name="name" type="text" placeholder="Your name" maxlength="150" required></label>
                <label>Email<input name="email" type="email" placeholder="Your email" maxlength="254" required></label>
                <label>Message<textarea name="message" placeholder="How can we help?" maxlength="10000" required></textarea></label>
                <label hidden>Website<input name="website" tabindex="-1" autocomplete="off"></label>
                <button class="btn btn--gold" type="submit">Send Message</button>
                <p data-contact-status role="status" aria-live="polite"></p>
              </form>
            </article>
          </div>
        </section>
      `,
    }),
  "/branches/chadwell-heath": renderHome,
};

function matchCalendarBranch(location) {
  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\b(lpc|pentecostal|church)\b/g, "")
      .replace(/[^a-z0-9]/g, "");
  const raw = String(location || "").toLowerCase(),
    normalized = normalize(location);
  return Object.values(branchConfig.branches)
    .map((branch) => ({
      branch,
      score: Math.max(
        0,
        ...[branch.churchName, branch.name, branch.address]
          .filter(Boolean)
          .map((value) => {
            const town = normalize(value);
            return raw.includes(value.toLowerCase())
              ? value.length + 100
              : town.length >= 5 && normalized.includes(town)
                ? town.length
                : 0;
          }),
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .find((match) => match.score > 0)?.branch;
}
function renderCalendarSection() {
  return '<section class="section section--calendar"><div class="container"><div class="calendar-heading"><div><p class="section-label">Church calendar</p><h2 class="section-title">Upcoming events at LPC</h2></div><div class="calendar-controls"><button type="button" data-calendar-direction="-1" aria-label="Previous events" disabled>←</button><button type="button" data-calendar-direction="1" aria-label="Next events" disabled>→</button></div></div><div class="calendar-tiles" tabindex="0" aria-label="Upcoming church events" aria-busy="true"><p class="calendar-message" role="status">Loading upcoming events…</p></div></div></section>';
}
async function hydrateCalendarEvents() {
  const track = document.querySelector(".calendar-tiles");
  if (!track) return;
  const controls = track
    .closest("section")
    .querySelectorAll("[data-calendar-direction]");
  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    controls.forEach(
      (b) =>
        (b.disabled =
          +b.dataset.calendarDirection < 0
            ? track.scrollLeft <= 1
            : track.scrollLeft >= max - 1),
    );
  };
  controls.forEach((b) =>
    b.addEventListener("click", () =>
      track.scrollBy({
        left:
          +b.dataset.calendarDirection *
          (track.querySelector(".calendar-tile")?.getBoundingClientRect()
            .width + 20 || 300),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      }),
    ),
  );
  track.addEventListener("scroll", update, { passive: true });
  const observer = new ResizeObserver(update);
  observer.observe(track);
  try {
    const response = await fetch("/api/calendar/events");
    if (!response.ok) throw Error("Calendar unavailable");
    const data = await response.json();
    if (!track.isConnected) {
      observer.disconnect();
      return;
    }
    if (!data.events?.length) {
      track.innerHTML =
        '<p class="calendar-message" role="status">Upcoming events will appear here soon.</p>';
      return;
    }
    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const time = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (!track.isConnected) {
      observer.disconnect();
      return;
    }
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const groups = new Map();
    for (const event of data.events) {
      const location = (event.location || "").trim();
      // Events without a venue remain separate rather than assuming they share one.
      const key =
        day.format(new Date(event.start)) +
        "|" +
        (location ? location.toLowerCase().replace(/\s+/g, " ") : event.id);
      if (!groups.has(key)) groups.set(key, { location, events: [] });
      groups.get(key).events.push(event);
    }
    track.innerHTML = [...groups.values()]
      .map((group) => {
        const first = group.events[0],
          location = group.location.toLowerCase();
        // Prefer the most specific match: South London contains the main church's name.
        const branch = matchCalendarBranch(group.location);
        const color = /^#[0-9a-f]{6}$/i.test(branch?.color || "")
          ? branch.color
          : "#102539";
        const rgb = color
          .slice(1)
          .match(/../g)
          .map((v) => parseInt(v, 16) / 255)
          .map((v) =>
            v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
          );
        const foreground =
          0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] > 0.179
            ? "#102539"
            : "#ffffff";
        return (
          '<article class="calendar-tile" style="--calendar-color:' +
          color +
          ";--calendar-text:" +
          foreground +
          '"><time datetime="' +
          escapeAttribute(first.start) +
          '">' +
          escapeHtml(date.format(new Date(first.start))) +
          "</time>" +
          (branch
            ? '<p class="calendar-tile__branch">' +
              escapeHtml(branch.calendarLabel || branch.name) +
              "</p>"
            : "") +
          '<div class="calendar-tile__services">' +
          group.events
            .map(
              (e) =>
                '<div class="calendar-tile__service"><h3>' +
                escapeHtml(e.title) +
                "</h3><p>" +
                escapeHtml(
                  e.allDay
                    ? "All day"
                    : time.format(new Date(e.start)) +
                        " – " +
                        (day.format(new Date(e.end)) !==
                        day.format(new Date(e.start))
                          ? date.format(new Date(e.end)) + " "
                          : "") +
                        time.format(new Date(e.end)),
                ) +
                "</p></div>",
            )
            .join("") +
          "</div>" +
          (group.location
            ? '<p class="calendar-tile__location">' +
              escapeHtml(group.location) +
              "</p>"
            : "") +
          "</article>"
        );
      })
      .join("");
    update();
    const section = track.closest("section"),
      motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pause = document.createElement("button");
    pause.type = "button";
    pause.className = "calendar-pause";
    pause.textContent = "Pause";
    pause.setAttribute("aria-label", "Pause automatic calendar scrolling");
    pause.setAttribute("aria-pressed", "false");
    section.querySelector(".calendar-controls").prepend(pause);
    let paused = motion.matches,
      hovered = false,
      visible = false,
      interactedUntil = 0;
    const setPause = () => {
      pause.textContent = paused ? "Play" : "Pause";
      pause.setAttribute("aria-pressed", String(paused));
      pause.setAttribute(
        "aria-label",
        paused
          ? "Start automatic calendar scrolling"
          : "Pause automatic calendar scrolling",
      );
    };
    setPause();
    pause.addEventListener("click", () => {
      paused = !paused;
      setPause();
    });
    section.addEventListener("mouseenter", () => (hovered = true));
    section.addEventListener("mouseleave", () => (hovered = false));
    ["pointerdown", "keydown", "wheel"].forEach((event) =>
      section.addEventListener(
        event,
        () => (interactedUntil = Date.now() + 10000),
        { passive: true },
      ),
    );
    const visibility = new IntersectionObserver(
      (entries) => (visible = entries[0].isIntersecting),
      { threshold: 0.25 },
    );
    visibility.observe(track);
    const timer = setInterval(() => {
      if (!track.isConnected) {
        clearInterval(timer);
        observer.disconnect();
        visibility.disconnect();
        return;
      }
      if (
        paused ||
        motion.matches ||
        hovered ||
        !visible ||
        document.hidden ||
        section.contains(document.activeElement) ||
        Date.now() < interactedUntil
      )
        return;
      const max = track.scrollWidth - track.clientWidth;
      if (max <= 1) return;
      track.scrollTo({
        left:
          track.scrollLeft >= max - 2
            ? 0
            : Math.min(
                max,
                track.scrollLeft +
                  (track
                    .querySelector(".calendar-tile")
                    ?.getBoundingClientRect().width || 300) +
                  20,
              ),
        behavior: "smooth",
      });
    }, 6000);
  } catch {
    if (track.isConnected)
      track.innerHTML =
        '<p class="calendar-message" role="status">The calendar is temporarily unavailable. Please check back shortly.</p>';
  } finally {
    track.setAttribute("aria-busy", "false");
    if (!track.isConnected) observer.disconnect();
  }
}

function homeDisclosure(title, preview, content) {
  return `<details class="home-disclosure"><summary><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(preview)}</small></span><span class="home-disclosure__chevron" aria-hidden="true">⌄</span></summary><div class="home-disclosure__body">${content}</div></details>`;
}
function renderHome() {
  return `
    <article class="page page-home">
      <section class="hero">
        <div class="container hero__inner">
          <div class="hero__content">
            <p class="eyebrow">London & Essex · A church for everyone</p>
            <h1 class="hero__title">Building a<br>spiritual <span class="accent">house</span></h1>
            <p class="hero__quote">for spiritual sacrifices</p>
            <p class="hero__copy">We’re a multicultural church family growing in faith and doing life together. Wherever you are on your journey, you’re welcome here.</p>
            <div class="hero__actions">
              <a class="btn btn--gold" href="#/plan-your-visit">Plan Your Visit</a>
              <a class="btn btn--hero-glass" href="#/watch"><span class="play-mark" aria-hidden="true">▶</span> Watch Sermons</a>
            </div>

          </div>
          ${renderHomeHeroMedia()}
        </div>
        <div class="hero-caption"><span>Worship. Community. Purpose.</span><a href="#/branches" class="explore-link">Find your community <span aria-hidden="true">↘</span></a><button class="hero-motion" type="button" aria-label="Pause background video">Pause video</button></div>
        <svg class="hero-sweep" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true"><path class="sweep-gold" d="M0 180C380 290 680 40 1060 65C1230 76 1350 109 1440 0V220H0Z" fill="#efc45b"/><path d="M0 193C370 284 745 91 1090 100C1250 104 1370 114 1440 45V220H0Z" fill="#fff"/><path class="swoosh-edge" d="M0 193C370 284 745 91 1090 100C1250 104 1370 114 1440 45" fill="none"/></svg>
        <svg class="hero-orbit" viewBox="0 0 700 700" fill="none" aria-hidden="true"><path d="M35 650C620 730 805 31 420 45C250 49 150 177 212 288" stroke="#efc45b" stroke-width="2"/></svg>
      </section>

      ${renderMediaSection(mediaSources.home, true)}
      <section class="quick-strip">
        <div class="container">
          <div class="quick-strip__grid">
            ${quickItem("calendar", "Join us this Sunday", "Find service details", "#/plan-your-visit")}
            ${quickItem("marker", "Find your church", "Across London & Essex", "#/branches")}
            ${quickItem("users", "The next generation", "Discover LPC Youth", "#/youth")}
            ${quickItem("play", "Church, wherever you are", "Watch online", "#/watch")}
          </div>
        </div>
      </section>

      <div class="container home-sections" aria-label="Explore LPC">
      ${homeDisclosure('Upcoming events', 'Dates, times and places for church events', renderCalendarSection())}
      ${homeDisclosure('Our branches', branchCards.length + ' churches · Find your local community', renderBranchesSection())}
      ${homeDisclosure('Stay connected', 'YouTube, Facebook and social updates', renderSocialSection(mediaSources.home, "LPC"))}
      ${homeDisclosure('Our people & your next step', 'Meet the pastors and plan your visit', `
      <section class="section section--tight section--leadership">
        <div class="container">
          <div class="team-ribbon">
            <div class="team-ribbon__intro">
              <p class="section-label">Our people</p><h3>Here to serve.<br>Here for you.</h3>
              <p>Leadership serving the LPC family across every branch.</p>
              <a class="btn btn--outline" href="#/pastors">Meet the Team</a>
            </div>
            <div class="team-ribbon__people">
              ${pastors
                .map(
                  ({ name, role }) => `
                    <div class="team-person">
                      <strong>${escapeHtml(name)}</strong>
                      <span>${escapeHtml(role)}</span>
                    </div>
                  `,
                )
                .join("")}
            </div>
          </div>

          <div class="welcome-banner">
            <div class="welcome-banner__copy">
              <p class="section-label">Your next step</p><h3>Come as you are.<br>Find your place.</h3>
              <p>Wherever you are on your journey, there's a place for you at LPC. Visit a branch, meet the family, and grow in faith with us.</p>
            </div>
            <div class="welcome-banner__actions">
              <a class="btn btn--gold" href="#/branches">Find Your Nearest Branch</a>
              <a class="btn btn--light" href="#/plan-your-visit">Plan Your Visit</a>
            </div>
            <div class="welcome-banner__media">
              <img src="./assets/images/derived/welcome-crowd.jpg" alt="Church fellowship">
            </div>
          </div>
        </div>
      </section>`)}
      </div>

      ${renderFooter()}
    </article>
  `;
}

function renderHomeHeroMedia() {
  const config = getHomeHeroConfig();
  const video = config.video?.trim();
  const poster = config.poster || defaultHomeHeroConfig.poster;
  const focal = config.focal || defaultHomeHeroConfig.focal;
  const mobileFocal = config.mobileFocal || focal;
  const scale = config.scale || defaultHomeHeroConfig.scale;
  const mobileScale = config.mobileScale || scale;
  const fit = config.fit || defaultHomeHeroConfig.fit;
  const mobileFit = config.mobileFit || fit;
  const label = config.label || defaultHomeHeroConfig.label;
  const title = config.title || defaultHomeHeroConfig.title;

  return `
    <div class="hero__media hero__media--video" style="--hero-focal:${escapeAttribute(focal)}; --hero-mobile-focal:${escapeAttribute(mobileFocal)}; --hero-scale:${escapeAttribute(scale)}; --hero-mobile-scale:${escapeAttribute(mobileScale)}; --hero-fit:${escapeAttribute(fit)}; --hero-mobile-fit:${escapeAttribute(mobileFit)};">
      <div class="hero__video-frame">
        ${
          video
            ? `<video class="hero__video" autoplay muted loop playsinline preload="metadata" poster="${escapeAttribute(poster)}" aria-label="${escapeAttribute(title)}">
                <source src="${escapeAttribute(video)}" type="${videoType(video)}">
              </video>`
            : `<img class="hero__video-poster" src="${escapeAttribute(poster)}" alt="${escapeAttribute(title)}">`
        }
        <div class="hero__video-tag">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
      </div>
    </div>
  `;
}

function getHomeHeroConfig() {
  const configured =
    window.LPC_HOME_HERO_CONFIG ||
    serverHomeHeroConfig ||
    localStorage.getItem(homeHeroStorageKey);
  if (!configured) return { ...defaultHomeHeroConfig };

  try {
    const parsed =
      typeof configured === "string" ? JSON.parse(configured) : configured;
    return { ...defaultHomeHeroConfig, ...parsed };
  } catch {
    return { ...defaultHomeHeroConfig };
  }
}

function getHeroImageConfig(key, fallbackImage) {
  const defaults = heroImageDefaults[key] || {
    desktopImage: fallbackImage,
    mobileImage: "",
    desktopFocal: "center",
    mobileFocal: "center",
    desktopScale: "1",
    mobileScale: "1",
    desktopFit: "cover",
    mobileFit: "cover",
  };
  const configured = serverHeroImagesConfig[key] || {};
  return {
    video: configured.video || defaults.video || "",
    desktopImage:
      configured.desktopImage || defaults.desktopImage || fallbackImage,
    mobileImage: configured.mobileImage || defaults.mobileImage || "",
    desktopFocal: configured.desktopFocal || defaults.desktopFocal || "center",
    mobileFocal:
      configured.mobileFocal ||
      defaults.mobileFocal ||
      configured.desktopFocal ||
      "center",
    desktopScale: configured.desktopScale || defaults.desktopScale || "1",
    mobileScale:
      configured.mobileScale ||
      defaults.mobileScale ||
      configured.desktopScale ||
      "1",
    desktopFit: configured.desktopFit || defaults.desktopFit || "cover",
    mobileFit:
      configured.mobileFit ||
      defaults.mobileFit ||
      configured.desktopFit ||
      "cover",
  };
}

function getPastorThoughtConfig() {
  return { ...defaultPastorThoughtConfig, ...(pastorThoughtConfig || {}) };
}

function getSiteSettingsConfig() {
  return { ...defaultSiteSettingsConfig, ...(siteSettingsConfig || {}) };
}

function renderPastorThoughtCopy() {
  const thought = getPastorThoughtConfig();
  const meta = [thought.author, thought.date].filter(Boolean).join(" - ");
  return `
    <span class="pastor-thought__body">${escapeHtml(thought.body)}</span>
    ${meta ? `<span class="pastor-thought__meta">${escapeHtml(meta)}</span>` : ""}
  `;
}

function videoType(url) {
  const cleanUrl = url.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".webm")) return "video/webm";
  if (cleanUrl.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

function renderAssetPickerInput({
  name,
  value = "",
  placeholder = "",
  type = "image",
}) {
  const label = type === "video" ? "Browse videos" : "Browse images";
  return `
    <div class="admin-asset-field">
      <input name="${escapeAttribute(name)}" type="text" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}">
      <button class="btn btn--outline admin-asset-field__button" type="button" data-asset-picker="${escapeAttribute(type)}">${label}</button>
    </div>
  `;
}

function focusNumberToPosition(value) {
  const number = Math.min(9, Math.max(1, Number(value) || 5));
  return `center ${Math.round(((number - 1) / 8) * 100)}%`;
}

function focusPositionToNumber(value) {
  const text = String(value || "")
    .toLowerCase()
    .trim();
  if (!text || text === "center") return 5;
  if (text.includes("top")) return 1;
  if (text.includes("bottom")) return 9;
  const percentMatch = text.match(/(\d+(?:\.\d+)?)%/);
  if (!percentMatch) return 5;
  const percent = Math.min(100, Math.max(0, Number(percentMatch[1]) || 50));
  return Math.min(9, Math.max(1, Math.round(percent / 12.5) + 1));
}

function renderFocusSelector(name, value) {
  const selected = focusPositionToNumber(value);
  return `
    <div class="admin-focus-scale" role="radiogroup" aria-label="${escapeAttribute(name)} focus">
      ${Array.from({ length: 9 }, (_, index) => {
        const number = index + 1;
        return `
          <label class="admin-focus-scale__option">
            <input name="${escapeAttribute(name)}" type="radio" value="${number}" ${number === selected ? "checked" : ""}>
            <span>${number}</span>
          </label>
        `;
      }).join("")}
    </div>
    <span>Use 1 when the important part is near the top, 5 for centre framing, and 9 when the important part is near the bottom.</span>
  `;
}

function scaleNumberToValue(value) {
  const number = Math.min(9, Math.max(1, Number(value) || 5));
  return String(Number((0.8 + ((number - 1) / 8) * 0.45).toFixed(3)));
}

function scaleValueToNumber(value) {
  const scale = Math.min(1.25, Math.max(0.8, Number(value) || 1));
  return Math.min(9, Math.max(1, Math.round(((scale - 0.8) / 0.45) * 8) + 1));
}

function renderScaleSelector(name, value) {
  const selected = scaleValueToNumber(value);
  return `
    <div class="admin-focus-scale" role="radiogroup" aria-label="${escapeAttribute(name)} size">
      ${Array.from({ length: 9 }, (_, index) => {
        const number = index + 1;
        return `
          <label class="admin-focus-scale__option">
            <input name="${escapeAttribute(name)}" type="radio" value="${number}" ${number === selected ? "checked" : ""}>
            <span>${number}</span>
          </label>
        `;
      }).join("")}
    </div>
    <span>Use 1 to shrink and show more, 5 for normal size, and 9 to zoom in and crop more.</span>
  `;
}

function normalizeFitMode(value) {
  return ["cover", "contain", "fill"].includes(value) ? value : "cover";
}

function renderFitSelector(name, value) {
  const selected = normalizeFitMode(value);
  return `
    <select name="${escapeAttribute(name)}" class="admin-fit-select">
      <option value="cover" ${selected === "cover" ? "selected" : ""}>Fill frame - crop edges</option>
      <option value="contain" ${selected === "contain" ? "selected" : ""}>Fit whole image - no crop</option>
      <option value="fill" ${selected === "fill" ? "selected" : ""}>Stretch to frame</option>
    </select>
    <span>Use Fit whole image when the design is being cut off. Stretch fills the frame but can distort proportions.</span>
  `;
}

function renderHomeHeroAdminFields() {
  const config = getHomeHeroConfig();
  return `
          <form class="admin-form" id="home-hero-form">
            <label>Video URL
              ${renderAssetPickerInput({
                name: "video",
                value: config.video || "",
                placeholder: "./assets/videos/baptism-hero.mp4",
                type: "video",
              })}
              <span>Use a local site path like ./assets/videos/baptism-hero.mp4 or a direct online .mp4/.webm URL. Leave blank to use the poster image.</span>
            </label>
            <label>Poster Image URL
              ${renderAssetPickerInput({
                name: "poster",
                value: config.poster || "",
                placeholder: "./assets/images/derived/hero-crowd-plain.jpg",
                type: "image",
              })}
            </label>
            <label>Desktop Focus
              ${renderFocusSelector("focal", config.focal || defaultHomeHeroConfig.focal)}
            </label>
            <label>Mobile Focus
              ${renderFocusSelector("mobileFocal", config.mobileFocal || defaultHomeHeroConfig.mobileFocal)}
            </label>
            <div class="admin-hero-card__grid">
              <label>Desktop Size
                ${renderScaleSelector("scale", config.scale || defaultHomeHeroConfig.scale)}
              </label>
              <label>Mobile Size
                ${renderScaleSelector("mobileScale", config.mobileScale || defaultHomeHeroConfig.mobileScale)}
              </label>
            </div>
            <div class="admin-hero-card__grid">
              <label>Desktop Frame Fit
                ${renderFitSelector("fit", config.fit || defaultHomeHeroConfig.fit)}
              </label>
              <label>Mobile Frame Fit
                ${renderFitSelector("mobileFit", config.mobileFit || defaultHomeHeroConfig.mobileFit)}
              </label>
            </div>
            <label>Small Label
              <input name="label" type="text" value="${escapeAttribute(config.label || "")}" placeholder="Baptism Sunday">
            </label>
            <label>Hero Media Title
              <input name="title" type="text" value="${escapeAttribute(config.title || "")}" placeholder="Baptism, worship, prayer, and fellowship">
            </label>
            <div class="admin-form__actions">
              <button class="btn btn--gold" type="submit">Save Hero</button>
              <button class="btn btn--outline" type="button" data-reset-home-hero>Reset</button>
              <a class="btn btn--light" href="#/home">View Home</a>
            </div>
          </form>
  `;
}

function renderAdminPanel() {
  if (!adminSession.authenticated) return renderAdminLogin();
  return `
    <article class="page">
      <section class="section section--tight section--admin-hero">
        <div class="container admin-panel admin-dashboard">
          <div class="admin-panel__header">
            <div>
              <p class="section-label">Admin Control Panel</p>
              <h1 class="section-title">Manage your church website</h1>
              <p class="section-copy">Manage user access, weekly schedules, pastors, branches, and website content.</p>
            </div>
            <button class="btn btn--outline" type="button" data-admin-logout>Sign out</button>
          </div>
          <nav class="admin-maintenance-links admin-shortcut-grid" aria-label="Website maintenance">
            <a href="#/lpcadmin/users"><span class="admin-shortcut-icon" aria-hidden="true">01</span><strong>Users &amp; access</strong><small>User profiles, accounts, serving roles and scheduler permissions</small><span class="admin-shortcut-open">Manage users →</span></a>
            <a href="#/lpcadmin/volunteers"><span class="admin-shortcut-icon" aria-hidden="true">02</span><strong>Weekly planner</strong><small>Meetings, pastors and volunteer duties</small><span class="admin-shortcut-open">Open planner →</span></a>
            <a href="#/lpcadmin/pastors"><span class="admin-shortcut-icon" aria-hidden="true">03</span><strong>Pastor profiles</strong><small>Photos, names and introductions</small><span class="admin-shortcut-open">Manage pastors →</span></a>
            <a href="#/lpcadmin/branches"><span class="admin-shortcut-icon" aria-hidden="true">04</span><strong>Church branches</strong><small>Colours, service times and contact details</small><span class="admin-shortcut-open">Manage branches →</span></a>
            <a href="#/lpcadmin/assets"><span class="admin-shortcut-icon" aria-hidden="true">05</span><strong>Photos & videos</strong><small>Find, upload and reuse website media</small><span class="admin-shortcut-open">Open media library →</span></a>
          </nav>
          <details class="admin-section-fold"><summary><strong>Pastor’s thought</strong><span>Edit the message on the Watch page</span></summary>${renderPastorThoughtAdminFields()}</details>
          <details class="admin-section-fold"><summary><strong>Website header message</strong><span>Edit the announcement at the top of the website</span></summary>${renderSiteSettingsAdminFields()}</details>
          <details class="admin-section-fold admin-images-fold"><summary><strong>Page images and heroes</strong><span>Open image, video and crop settings</span></summary><section class="admin-panel__section">
            <div class="admin-panel__section-heading">
              <h2>Page images and heroes</h2><a class="btn btn--gold" href="#/lpcadmin/page-images">Edit images within pages</a>
              <p>Open a tile to edit the active video/image, desktop crop, and mobile crop. After saving, you return here and the preview updates.</p>
            </div>
            <div class="admin-hero-tiles">
              ${renderHeroPreviewTiles()}
            </div>
          </section></details>
        </div>
      </section>
      ${renderFooter()}
    </article>
  `;
}

function renderAdminHeroEditor(key) {
  if (!adminSession.authenticated) return renderAdminLogin();
  if (key === "home") return renderAdminHomeHeroEditor();
  if (!heroImageDefaults[key]) {
    return `
      <article class="page">
        <section class="section section--tight section--admin-hero">
          <div class="container">
            <p class="section-label">Hero Editor</p>
            <h1 class="section-title">Hero component not found.</h1>
            <p style="margin-top:24px"><a class="btn btn--gold" href="#/lpcadmin">Back to admin</a></p>
          </div>
        </section>
        ${renderFooter()}
      </article>
    `;
  }

  return `
    <article class="page">
      <section class="section section--tight section--admin-hero">
        <div class="container admin-panel">
          <div class="admin-panel__header">
            <div>
              <p class="section-label">Hero Editor</p>
              <h1 class="section-title">${heroLabel(key)} hero</h1>
              <p class="section-copy">Update the video or image for this page. Leave video blank to use image mode.</p>
            </div>
            <a class="btn btn--outline" href="#/lpcadmin">Back to previews</a>
          </div>
          <div class="admin-editor-layout">
            ${renderHeroPreviewTile(key, true)}
            ${renderHeroImageEditorForm(key)}
          </div>
        </div>
      </section>
      ${renderFooter()}
    </article>
  `;
}

function renderAdminHomeHeroEditor() {
  return `
    <article class="page">
      <section class="section section--tight section--admin-hero">
        <div class="container admin-panel">
          <div class="admin-panel__header">
            <div>
              <p class="section-label">Hero Editor</p>
              <h1 class="section-title">Home page video hero</h1>
              <p class="section-copy">Use a controlled video for the main homepage hero, with poster and focal settings.</p>
            </div>
            <a class="btn btn--outline" href="#/lpcadmin">Back to previews</a>
          </div>
          <div class="admin-editor-layout">
            ${renderHomeHeroPreviewTile(true)}
            ${renderHomeHeroAdminFields()}
          </div>
        </div>
      </section>
      ${renderFooter()}
    </article>
  `;
}

function renderSiteSettingsAdminFields() {
  const settings = getSiteSettingsConfig();
  return `
    <form class="admin-form" id="site-settings-form">
      <label>Top bar slogan
        <input name="topbarSlogan" type="text" value="${escapeAttribute(settings.topbarSlogan)}" placeholder="Celebrating 25 Years of God's Faithfulness">
        <span>This controls the small message above the main navigation.</span>
      </label>
      <div class="admin-form__actions">
        <button class="btn btn--gold" type="submit">Save Header Message</button>
      </div>
    </form>
  `;
}

function renderPastorThoughtAdminFields() {
  const thought = getPastorThoughtConfig();
  return `
    <form class="admin-form" id="pastor-thought-form">
      <label>Kicker
        <input name="kicker" type="text" value="${escapeAttribute(thought.kicker)}" placeholder="Pastor's Thought">
      </label>
      <label>Title
        <input name="title" type="text" value="${escapeAttribute(thought.title)}" placeholder="A word of encouragement for this week">
      </label>
      <label>Thought / Encouragement
        <textarea name="body" rows="6" placeholder="Write the pastoral thought here...">${escapeHtml(thought.body)}</textarea>
      </label>
      <div class="admin-hero-card__grid">
        <label>Author
          <input name="author" type="text" value="${escapeAttribute(thought.author)}" placeholder="Pr Sam John">
        </label>
        <label>Date / Season
          <input name="date" type="text" value="${escapeAttribute(thought.date)}" placeholder="Sunday 16 June">
        </label>
      </div>
      <div class="admin-hero-card__grid">
        <label>Button Text
          <input name="ctaText" type="text" value="${escapeAttribute(thought.ctaText)}" placeholder="Watch Sermons">
        </label>
        <label>Button Link
          <input name="ctaHref" type="text" value="${escapeAttribute(thought.ctaHref)}" placeholder="#/watch">
        </label>
      </div>
      <div class="admin-form__actions">
        <button class="btn btn--gold" type="submit">Publish Thought</button>
        <a class="btn btn--light" href="#/watch">View Watch Page</a>
      </div>
    </form>
  `;
}

function renderAdminLogin() {
  return `
    <article class="page">
      <section class="section section--tight section--admin-hero">
        <div class="container admin-login">
          <div>
            <p class="section-label">Website administration</p>
            <h1 class="section-title">Website admin sign-in</h1>
            <p class="section-copy">Use the website administrator username and password. This is a separate account from volunteer sign-in.</p>
            <p class="section-copy"><a href="#/volunteers">Pastor, choir or media volunteer? Sign in to the weekly planner</a>.</p>
            <details><summary>Forgot the website admin login?</summary><p>Email reset does not apply to this account. The site owner must replace the administrator username or password in hosting settings. Contact <a href="mailto:media@londonpentecostalchurch.org">media@londonpentecostalchurch.org</a> for help.</p></details>
          </div>
          <form class="admin-form" id="admin-login-form">
            <label>Username
              <input name="username" type="text" autocomplete="username" required>
            </label>
            <label>Password
              <input name="password" type="password" autocomplete="current-password" required>
            </label>
            <p class="admin-form__message" data-admin-login-message></p>
            <div class="admin-form__actions">
              <button class="btn btn--gold" type="submit">Login</button>
            </div>
          </form>
        </div>
      </section>
      ${renderFooter()}
    </article>
  `;
}

function renderHeroImageControls() {
  return Object.entries(heroImageDefaults)
    .map(([key, defaults]) => {
      const config = getHeroImageConfig(key, defaults.desktopImage);
      return `
        <fieldset class="admin-hero-card" data-hero-key="${key}">
          <legend>${heroLabel(key)}</legend>
          <label>Hero video URL
            ${renderAssetPickerInput({
              name: `${key}__video`,
              value: config.video || "",
              placeholder: `./assets/videos/${key}-hero.mp4`,
              type: "video",
            })}
            <span>Optional. Use a local site path or direct online .mp4/.webm URL.</span>
          </label>
          <label>Desktop image URL
            ${renderAssetPickerInput({
              name: `${key}__desktopImage`,
              value: config.desktopImage,
              type: "image",
            })}
            <span>Used as the image hero, or as the video poster/fallback when a video URL is set.</span>
          </label>
          <label>Mobile image URL
            ${renderAssetPickerInput({
              name: `${key}__mobileImage`,
              value: config.mobileImage,
              placeholder: "Leave blank to reuse desktop image",
              type: "image",
            })}
            <span>Used only when no video URL is set.</span>
          </label>
          <div class="admin-hero-card__grid">
            <label>Desktop focus
              ${renderFocusSelector(`${key}__desktopFocal`, config.desktopFocal)}
            </label>
            <label>Mobile focus
              ${renderFocusSelector(`${key}__mobileFocal`, config.mobileFocal)}
            </label>
          </div>
          <div class="admin-hero-card__grid">
            <label>Desktop size
              ${renderScaleSelector(`${key}__desktopScale`, config.desktopScale)}
            </label>
            <label>Mobile size
              ${renderScaleSelector(`${key}__mobileScale`, config.mobileScale)}
            </label>
          </div>
          <div class="admin-hero-card__grid">
            <label>Desktop frame fit
              ${renderFitSelector(`${key}__desktopFit`, config.desktopFit)}
            </label>
            <label>Mobile frame fit
              ${renderFitSelector(`${key}__mobileFit`, config.mobileFit)}
            </label>
          </div>
        </fieldset>
      `;
    })
    .join("");
}

function renderHeroPreviewTiles() {
  return [
    renderHomeHeroPreviewTile(),
    ...Object.keys(heroImageDefaults).map((key) => renderHeroPreviewTile(key)),
  ].join("");
}

function renderHomeHeroPreviewTile(isLarge = false, previewConfig = null) {
  const config = previewConfig || getHomeHeroConfig();
  const media = config.video
    ? `<video autoplay muted loop playsinline preload="metadata" poster="${escapeAttribute(config.poster)}">
        <source src="${escapeAttribute(config.video)}" type="${videoType(config.video)}">
      </video>`
    : `<img src="${escapeAttribute(config.poster)}" alt="Home hero poster">`;
  return `
    <a class="admin-hero-tile ${isLarge ? "admin-hero-tile--large" : ""}" href="#/lpcadmin/hero/home" data-admin-preview="home">
      <span class="admin-hero-tile__media" style="--tile-scale:${escapeAttribute(config.scale || "1")}; --tile-fit:${escapeAttribute(config.fit || "cover")}">${media}</span>
      <span class="admin-hero-tile__body">
        <strong>Home</strong>
        <span>${config.video ? "Video hero" : "Image fallback"}</span>
      </span>
    </a>
  `;
}

function renderHeroPreviewTile(key, isLarge = false, previewConfig = null) {
  const config =
    previewConfig ||
    getHeroImageConfig(key, heroImageDefaults[key]?.desktopImage);
  const media = config.video
    ? `<video autoplay muted loop playsinline preload="metadata" poster="${escapeAttribute(config.desktopImage)}">
        <source src="${escapeAttribute(config.video)}" type="${videoType(config.video)}">
      </video>`
    : `<picture>
        ${config.mobileImage ? `<source media="(max-width: 760px)" srcset="${escapeAttribute(config.mobileImage)}">` : ""}
        <img src="${escapeAttribute(config.desktopImage)}" alt="${escapeAttribute(heroLabel(key))} hero">
      </picture>`;
  return `
    <a class="admin-hero-tile ${isLarge ? "admin-hero-tile--large" : ""}" href="#/lpcadmin/hero/${key}" data-admin-preview="${escapeAttribute(key)}">
      <span class="admin-hero-tile__media" style="--tile-focal:${escapeAttribute(config.desktopFocal)}; --tile-scale:${escapeAttribute(config.desktopScale)}; --tile-fit:${escapeAttribute(config.desktopFit)}">${media}</span>
      <span class="admin-hero-tile__body">
        <strong>${heroLabel(key)}</strong>
        <span>${config.video ? "Video hero" : config.mobileImage ? "Desktop + mobile images" : "Image hero"}</span>
      </span>
    </a>
  `;
}

function renderHeroImageEditorForm(key) {
  const config = getHeroImageConfig(key, heroImageDefaults[key].desktopImage);
  return `
    <form class="admin-form" id="hero-image-editor-form" data-hero-key="${key}">
      <label>Hero video URL
        ${renderAssetPickerInput({
          name: "video",
          value: config.video || "",
          placeholder: `./assets/videos/${key}-hero.mp4`,
          type: "video",
        })}
        <span>Optional. Use a local site path or direct online .mp4/.webm URL.</span>
      </label>
      <label>Desktop image URL
        ${renderAssetPickerInput({
          name: "desktopImage",
          value: config.desktopImage,
          type: "image",
        })}
        <span>Used as the image hero, or as the video poster/fallback when a video URL is set.</span>
      </label>
      <label>Mobile image URL
        ${renderAssetPickerInput({
          name: "mobileImage",
          value: config.mobileImage,
          placeholder: "Leave blank to reuse desktop image",
          type: "image",
        })}
        <span>Used only when no video URL is set.</span>
      </label>
      <div class="admin-hero-card__grid">
        <label>Desktop focus
          ${renderFocusSelector("desktopFocal", config.desktopFocal)}
        </label>
        <label>Mobile focus
          ${renderFocusSelector("mobileFocal", config.mobileFocal)}
        </label>
      </div>
      <div class="admin-hero-card__grid">
        <label>Desktop size
          ${renderScaleSelector("desktopScale", config.desktopScale)}
        </label>
        <label>Mobile size
          ${renderScaleSelector("mobileScale", config.mobileScale)}
        </label>
      </div>
      <div class="admin-hero-card__grid">
        <label>Desktop frame fit
          ${renderFitSelector("desktopFit", config.desktopFit)}
        </label>
        <label>Mobile frame fit
          ${renderFitSelector("mobileFit", config.mobileFit)}
        </label>
      </div>
      <div class="admin-form__actions">
        <button class="btn btn--gold" type="submit">Save Hero</button>
        <a class="btn btn--light" href="#/lpcadmin">Cancel</a>
        <p class="admin-form__message" data-form-status role="status" aria-live="polite"></p>
      </div>
    </form>
  `;
}

function heroLabel(key) {
  if (branchConfig.branches[key]) return branchConfig.branches[key].name;
  return key
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function renderSubPage({
  pageKey,
  label,
  title,
  copy,
  image,
  actions = [],
  body,
}) {
  const hero = getHeroImageConfig(pageKey, image);
  return `
    <article class="page">
      <section class="subhero">
        <div class="container subhero__inner">
          <div>
            <p class="eyebrow">${label}</p>
            <h1 class="subhero__title">${title}</h1>
            <p class="subhero__copy">${copy}</p>
            ${
              actions.length
                ? `<div class="subhero__actions">${actions
                    .map(
                      ([text, href, kind]) =>
                        `<a class="btn ${kind}" href="${href}">${text}</a>`,
                    )
                    .join("")}</div>`
                : ""
            }
          </div>
          <div class="subhero__media" style="--subhero-focal:${escapeAttribute(hero.desktopFocal)}; --subhero-mobile-focal:${escapeAttribute(hero.mobileFocal)}; --subhero-scale:${escapeAttribute(hero.desktopScale)}; --subhero-mobile-scale:${escapeAttribute(hero.mobileScale)}; --subhero-fit:${escapeAttribute(hero.desktopFit)}; --subhero-mobile-fit:${escapeAttribute(hero.mobileFit)};">
            ${
              hero.video
                ? `<video class="subhero__video" autoplay muted loop playsinline preload="metadata" poster="${escapeAttribute(hero.desktopImage)}" aria-label="${escapeAttribute(label)}">
                    <source src="${escapeAttribute(hero.video)}" type="${videoType(hero.video)}">
                  </video>`
                : `<picture>
                    ${hero.mobileImage ? `<source media="(max-width: 760px)" srcset="${escapeAttribute(hero.mobileImage)}">` : ""}
                    <img src="${escapeAttribute(hero.desktopImage)}" alt="${escapeAttribute(label)}">
                  </picture>`
            }
          </div>
        </div>
        <svg class="page-sweep" viewBox="0 0 1440 220" preserveAspectRatio="none" aria-hidden="true"><path d="M0 180C380 290 680 40 1060 65C1230 76 1350 109 1440 0V220H0Z" fill="#efc45b"/><path d="M0 193C370 284 745 91 1090 100C1250 104 1370 114 1440 45V220H0Z" fill="#fff"/><path class="swoosh-edge" d="M0 193C370 284 745 91 1090 100C1250 104 1370 114 1440 45" fill="none"/></svg>
      </section>
      ${body}
      ${renderFooter()}
    </article>
  `;
}

function renderBranchPage(branch, image) {
  const source = getBranchMedia(branch);
  return renderSubPage({
    pageKey: branch.slug,
    label: escapeHtml(branch.churchName),
    title: escapeHtml(branch.churchName),
    copy: escapeHtml(branch.summary),
    image,
    actions: [
      ["Back to Branches", "#/branches", "btn--gold"],
      ["Contact LPC", "#/contact", "btn--outline"],
    ],
    theme: branch,
    body: `
      <section class="section section--tight section--swoosh">
        <div class="container branch-engagement">
          <article class="branch-engagement__media">
            ${renderBranchHeroMedia(branch, image, source)}
            <div class="branch-engagement__panel">
              <h3>We Are a Full Church Family</h3>
              <ul>
                <li>Sunday Worship</li>
                <li>Sunday School</li>
                <li>Youth Church</li>
                <li>Women in Christ</li>
                <li>Men in Christ</li>
                <li>Cell Prayer Meetings</li>
              </ul>
            </div>
          </article>

          <div class="branch-engagement__content">
            <article class="content-card content-card--feature">
              <p class="section-label">What To Expect</p>
              <h3>Warm welcome, worship, prayer, and branch family life.</h3>
              <p>${escapeHtml(branch.summary)}</p>
              <p style="margin-top:14px">Every LPC branch carries the same worship culture, biblical teaching, and family heart while serving its local community faithfully.</p>
            </article>
            <div class="branch-engagement__cards">
              ${card("Service Life", escapeHtml(branch.services || "Contact this branch for service times."))}
              ${card("Local Connection", "A branch community for worship, friendship, pastoral care, and outreach.")}
            </div>
          </div>
        </div>
      </section>
      <section class="section section--tight"><div class="container branch-details">${branch.address ? card("Address", escapeHtml(branch.address)) : ""}${branch.services ? card("Service times", escapeHtml(branch.services)) : ""}${branch.contact ? card("Contact", escapeHtml(branch.contact)) : ""}</div></section>
      ${source ? renderSocialSection(source, branch.churchName) : ""}
    `,
  });
}

function renderBranchHeroMedia(branch, image, source) {
  if (!source)
    return image
      ? '<img src="' +
          escapeAttribute(image) +
          '" alt="' +
          escapeAttribute(branch.churchName) +
          ' church family">'
      : "";
  if (source?.youtubeHandle) {
    return `
      <div class="youtube-preview youtube-preview--hero" data-youtube-handle="${source.youtubeHandle}" data-youtube-url="${source.youtubeUrl}" data-youtube-title="${source.title}" data-youtube-autoplay="silent">
        <div class="youtube-player__status">
          <span class="youtube-play-mark">${icon("play")}</span>
          <h3>Loading ${branch.churchName} media</h3>
          <p>Preparing the latest Live tab video.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="branch-hero-social">
      <img src="${escapeAttribute(image)}" alt="${escapeAttribute(branch.churchName)} church family">
      <div>
        <span class="youtube-play-mark">${socialIcon("Facebook")}</span>
        <h3>${escapeHtml(branch.churchName)} video channel launching soon</h3>
        <p>Stay in touch through Facebook for service updates, photos, and branch announcements.</p>
      </div>
    </div>
  `;
}

function renderMediaSection(source, featured = false) {
  if (!source) return "";
  const socialLinks = source.socials
    .map(
      ([label, href]) =>
        `<a class="media-link" href="${href}" target="_blank" rel="noopener">${label}</a>`,
    )
    .join("");

  return `
    <section class="section section--tight section--media ${featured ? 'home-featured-media' : ''}">
      <div class="container media-section">
        <div class="media-section__header">
          <p class="section-label">Media</p>
          <h2 class="section-title">${source.title}</h2>
          <p class="section-copy">${featured ? 'Join the live service or watch the latest message.' : 'Make room for faith in your week. Join us online for worship and messages from our church family.'}</p>
        </div>
        <div class="media-section__body">
          ${
            source.youtubeHandle
              ? `
                <div class="youtube-preview" data-youtube-handle="${source.youtubeHandle}" data-youtube-url="${source.youtubeUrl}" data-youtube-title="${source.title}">
                  <div class="youtube-player__status">
                    <span class="youtube-play-mark">${icon("play")}</span>
                    <h3>Loading latest media</h3>
                    <p>Checking for a live stream first, then the latest video from ${source.youtubeHandle}.</p>
                  </div>
                </div>
              `
              : `
                <article class="media-fallback">
                  <h3>Branch media source</h3>
                  <p>This branch does not have a YouTube channel listed yet. Use the social media link below for current branch updates.</p>
                </article>
              `
          }
          <aside class="media-socials">
            <p class="media-kicker"><span></span>Live on Sundays</p>
            <h3>${source.watchTitle || "Watch online"}</h3>
            <p>${featured ? 'Worship with us wherever you are.' : 'Join the service live when available, catch up on the latest message, or open the full channel collection.'}</p>
            ${featured ? '<a class="btn btn--gold" href="#/watch">Watch services →</a>' : ''}
             <div class="footer__socials">
  ${mediaSources.home.socials
    .filter(([name]) => name !== "Instagram")
    .map(
      ([name, href]) =>
        `<a href="${href}" aria-label="${name}" target="_blank" rel="noopener">${socialIcon(name)}</a>`,
    )
    .join("")}
</div>
          </aside>
        </div>
      </div>
    </section>
  `;
}

function youtubeVideoId(value) {
  try {
    const u = new URL(value);
    let id = "";
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
    )
      id =
        u.searchParams.get("v") ||
        u.pathname.match(/^\/(?:embed|live|shorts)\/([^/]+)/)?.[1];
    return /^[a-zA-Z0-9_-]{11}$/.test(id || "") ? id : "";
  } catch {
    return "";
  }
}
function getBranchMedia(branch) {
  const fallback =
    mediaSources[branch.slug === "chadwell-heath" ? "home" : branch.slug] || {};
  const field = (key, old) =>
    Object.hasOwn(branch, key) ? branch[key] : old || "";
  const youtubeUrl = field("youtubeUrl", fallback.youtubeUrl);
  const social = (name) =>
    field(
      name.toLowerCase() + "Url",
      fallback.socials?.find((item) => item[0] === name)?.[1],
    );
  return {
    title: branch.churchName,
    watchTitle: "Watch " + branch.name + " online",
    youtubeUrl,
    videoUrl: branch.videoUrl || "",
    autoplay: branch.autoplay || "silent",
    youtubeHandle: fallback.youtubeHandle || "",
    socials: [
      ["Facebook", social("Facebook"), "News and events"],
      ["Instagram", social("Instagram"), "Church life"],
      ["YouTube", youtubeUrl, "Services and sermons"],
    ].filter((item) => item[1]),
  };
}
function mediaCollections() {
  return branchCards.map((branch) => ({
    key: branch.slug,
    label: branch.churchName,
    branchHref: "#/branches/" + branch.slug,
    source: getBranchMedia(branch),
  }));
}
function renderWatchHub() {
  const rows = mediaCollections()
    .map(({ key, label, branchHref, source }, index) => {
      const id = youtubeVideoId(source.videoUrl);
      const player = id
        ? '<div class="youtube-preview youtube-preview--compact"><iframe src="https://www.youtube.com/embed/' +
          id +
          "?playsinline=1&rel=0&controls=1" +
          (source.autoplay === "silent" ? "&autoplay=1&mute=1" : "") +
          '" title="' +
          escapeAttribute(label) +
          ' video" loading="eager" referrerpolicy="strict-origin-when-cross-origin" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>'
        : source.youtubeUrl
          ? '<div class="youtube-preview youtube-preview--compact" data-youtube-handle="' +
            escapeAttribute(source.youtubeHandle || "") +
            '" data-youtube-url="' +
            escapeAttribute(source.youtubeUrl) +
            '" data-youtube-title="' +
            escapeAttribute(label) +
            '" data-youtube-autoplay="' +
            escapeAttribute(source.autoplay || "silent") +
            '"><p class="youtube-player__status">Loading latest service...</p></div>'
          : '<div class="watch-collection__empty"><h3>' +
            (source.youtubeUrl ? "Watch on YouTube" : "Videos coming soon") +
            "</h3><p>" +
            (source.youtubeUrl
              ? "Open the channel to explore services and sermons."
              : "Visit this branch for service times and contact details.") +
            "</p></div>";
      const row = (
        '<article class="watch-row" data-watch-priority="' + (id ? '2' : '1') + '" data-watch-order="' + index + '" style="' +
        collectionThemeStyle(key) +
        '"><div class="watch-collection"><div class="watch-collection__meta"><p class="section-label">' +
        escapeHtml(label) +
        "</p><h3>" +
        escapeHtml(source.watchTitle) +
        "</h3></div>" +
        player +
        '<div class="watch-collection__actions">' +
        (source.youtubeUrl
          ? '<a class="btn btn--gold" href="' +
            escapeAttribute(source.youtubeUrl) +
            '" target="_blank" rel="noopener">Open YouTube channel</a>'
          : "") +
        (source.videoUrl
          ? '<a class="btn btn--outline" href="' +
            escapeAttribute(source.videoUrl) +
            '" target="_blank" rel="noopener">Open video</a>'
          : "") +
        '<a class="btn btn--outline" href="' +
        branchHref +
        '">Branch Page</a></div></div><aside class="watch-row__follow"><h3>Follow ' +
        escapeHtml(label) +
        '</h3><div class="watch-follow-grid">' +
        source.socials
          .map(
            ([name, url, description]) =>
              '<a class="social-card social-card--' +
              name.toLowerCase() +
              '" href="' +
              escapeAttribute(url) +
              '" target="_blank" rel="noopener"><span class="social-card__icon">' +
              socialIcon(name) +
              "</span><strong>" +
              name +
              "</strong><span>" +
              description +
              "</span></a>",
          )
          .join("") +
        (source.socials.length
          ? ""
          : '<p>Contact this branch for updates.</p><a href="' +
            branchHref +
            '">View branch details</a>') +
        "</div></aside></article>"
      );
      const available = !!(id || source.youtubeUrl);
      return { available, priority: id ? 2 : 1, html: available ? row : '<details class="watch-coming-soon" style="' + collectionThemeStyle(key) + '"><summary><span><strong>' + escapeHtml(label) + '</strong><small>Videos coming soon · Open for branch details</small></span><span aria-hidden="true">⌄</span></summary><div class="watch-coming-soon__body">' + row + '</div></details>' };
    })
    .sort((a,b) => b.priority - a.priority);
  const availableRows = rows.filter(row => row.available).map(row => row.html).join('');
  const upcomingRows = rows.filter(row => !row.available).map(row => row.html).join('');
  return (
    '<section class="section section--watch-hub"><div class="container watch-hub"><h2 class="section-title">Watch services</h2><p>Live streams and available videos appear first. Open other branches below for updates.</p><div class="watch-hub__rows" data-watch-available>' +
    (availableRows || '<p>No videos are available yet. Open a branch below for updates.</p>') +
    '</div>' + (upcomingRows ? '<section class="watch-upcoming"><h3>More branches · Videos coming soon</h3><div class="watch-upcoming__rows">' + upcomingRows + '</div></section>' : '') + '</div></section>'
  );
}

function prioritiseWatchPlayer(player, mode) {
  const row = player.closest('.watch-row[data-watch-priority]');
  if (!row || !row.parentElement.matches('[data-watch-available]')) return;
  row.dataset.watchPriority = mode === 'Live now' ? '3' : '2';
  const list = row.parentElement;
  const next = [...list.children].find(entry => entry !== row && (Number(entry.dataset.watchPriority) < Number(row.dataset.watchPriority) || (entry.dataset.watchPriority === row.dataset.watchPriority && Number(entry.dataset.watchOrder) > Number(row.dataset.watchOrder))));
  if (row.nextElementSibling !== (next || null)) list.insertBefore(row, next || null);
}

function collectionColor(key) {
  const branch = branchCards.find((item) => item.slug === key);
  return branch?.color || defaultTheme.primary;
}

function collectionThemeStyle(key) {
  const branch = branchCards.find(
    (item) => item.slug === (key === "home" ? "chadwell-heath" : key),
  );
  const color = branch?.color || defaultTheme.primary;
  const palette = {
    color,
    mid: "color-mix(in srgb, " + color + " 85%, #000)",
    dark: "color-mix(in srgb, " + color + " 55%, #000)",
    accent: "color-mix(in srgb, " + color + " 25%, #fff)",
    soft: "color-mix(in srgb, " + color + " 8%, #fff)",
  };
  return (
    Object.entries(palette)
      .map(([name, value]) => "--collection-" + name + ":" + value)
      .join(";") +
    ";--theme-primary:" +
    palette.color +
    ";--theme-mid:" +
    palette.mid +
    ";--theme-dark:" +
    palette.dark +
    ";--theme-accent:" +
    palette.accent +
    ";--theme-soft:" +
    palette.soft
  );
}

function renderSocialSection(source, label) {
  if (!source?.socials?.length) return "";
  const cards = source.socials
    .map(
      ([name, href, description]) => `
        <a class="social-card social-card--${name.toLowerCase()}" href="${href}" target="_blank" rel="noopener">
          <span class="social-card__icon">${socialIcon(name)}</span>
          <strong>${name}</strong>
          <span>${description || "Stay connected with branch updates"}</span>
        </a>
      `,
    )
    .join("");

  return `
    <section class="section section--tight section--social">
      <div class="container social-section">
        <div class="section-heading section-heading--left">
          <p class="section-label">Stay Connected</p>
          <h2 class="section-title">Follow ${label}</h2>
        </div>
        <div class="social-grid">${cards}</div>
      </div>
    </section>
  `;
}

function socialIcon(name) {
  const icons = {
    YouTube: `

<svg
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path
    fill="currentColor"
    fill-rule="evenodd"
    clip-rule="evenodd"
    d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6l6.3-3.6-6.3-3.6v7.2Z"
  />
</svg>

`,
    Facebook: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 8.2h2V5h-2.4C10.8 5 9 6.8 9 9.6V12H7v3.2h2V21h3.5v-5.8H15l.6-3.2h-3.1V9.9c0-1 .5-1.7 1.5-1.7Z" fill="currentColor"/></svg>`,
    Instagram: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="4" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="8" r="1" fill="currentColor"/></svg>`,
  };
  return icons[name] || icons.YouTube;
}

function renderBranchesSection(includePadding = false) {
  return (
    '<section class="section section--branches"><div class="container"><div class="section-heading"><p class="section-label">Our Branches</p><h2 class="section-title">One family. Many places to belong.</h2><p class="section-copy">Find a community near you for worship, friendship and a shared life of faith.</p></div><div class="branch-grid">' +
    branchCards
      .map((branch) => ({
        ...branch,
        image: getHeroImageConfig(branch.slug, branch.image).desktopImage,
      }))
      .map(
        (branch) =>
          '<article class="branch-card" style="--branch-color:' +
          escapeAttribute(branch.color) +
          '"><div class="branch-card__photo">' +
          (branch.image
            ? '<img loading="eager" referrerpolicy="strict-origin-when-cross-origin" src="' +
              escapeAttribute(branch.image) +
              '" alt="' +
              escapeAttribute(branch.churchName) +
              ' community">'
            : "") +
          '</div><div class="branch-card__brand">' +
          (branch.logo
            ? '<img class="branch-card__logo" src="' +
              escapeAttribute(branch.logo) +
              '" alt="' +
              escapeAttribute(branch.churchName) +
              ' logo">'
            : "") +
          "</div><h3>" +
          escapeHtml(branch.name) +
          "</h3><p>" +
          escapeHtml(branch.subtitle) +
          '</p><a class="btn" href="#/branches/' +
          branch.slug +
          '">Explore church</a></article>',
      )
      .join("") +
    "</div>" +
    (branchCards.length
      ? ""
      : "<p>Branch information will be available soon.</p>") +
    "</div></section>"
  );
}

function renderFooter() {
  const branch = branchCards.find(
    (item) => normalizeRoute() === `/branches/${item.slug}`,
  );
  return `
    <footer class="footer">
      <svg class="footer-swoosh" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 86C300 12 460 8 720 8C1080 8 1290 22 1440 4L1440 0H0Z" fill="#fff"/><path d="M0 86C300 12 460 8 720 8C1080 8 1290 22 1440 4" fill="none" stroke="#efc45b" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>
      <div class="container">
        <div class="footer__inner">
          <section class="footer__brand">
            <div class="footer__brandmark">
              <img src="${escapeAttribute(branch?.logo || defaultTheme.logo)}" alt="${escapeAttribute(branch?.churchName || "LPC")} logo">
              <div>
                <strong>${escapeHtml(branch?.churchName || "London Pentecostal Church")}</strong>
                <p style="margin:6px 0 0">Part of Alpha International Ministries</p>
              </div>
            </div>
            <p>Building a spiritual house for spiritual sacrifices</p>
            <div class="footer__socials">
              ${mediaSources.home.socials.map(([name, href]) => `<a href="${href}" aria-label="${name}" target="_blank" rel="noopener">${socialIcon(name)}</a>`).join("")}
            </div>
          </section>

          <section class="footer__column">
            <h4>Quick Links</h4>
            <ul>
              <li><a href="#/about">About Us</a></li>
              <li><a href="#/pastors">Pastors</a></li>
              <li><a href="#/ministries">Ministries</a></li>
              <li><a href="#/youth">Youth</a></li>
              <li><a href="#/branches">Branches</a></li>
              <li><a href="#/watch">Watch</a></li>
              <li><a href="#/contact">Contact</a></li>
            </ul>
          </section>

        <section class="footer__column">
  <h4>Contact Us</h4>

  <p class="footer__address">
    ${
      branch
        ? escapeHtml(
            branch.address || "Branch address to be confirmed.",
          ).replaceAll("\n", "<br>")
        : "Oasis Centre, Essex Rd, <br> Romford RM6 4JA"
    }
  </p>

  <div class="footer__contact-item">
    <svg width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2
        19.79 19.79 0 0 1-8.63-3.07
        19.5 19.5 0 0 1-6-6
        19.79 19.79 0 0 1-3.07-8.67
        A2 2 0 0 1 4.11 2h3
        a2 2 0 0 1 2 1.72
        c.12.96.36 1.9.7 2.8
        a2 2 0 0 1-.45 2.11L8.09 9.91
        a16 16 0 0 0 6 6l1.27-1.27
        a2 2 0 0 1 2.11-.45
        c.9.34 1.84.58 2.8.7
        A2 2 0 0 1 22 16.92Z"/>
    </svg>

    <a href="tel:+442086900701">+44 20 8690 0701</a>
  </div>

  <div class="footer__contact-item">
    <svg width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round"
      aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="m3 7 9 6 9-6"/>
    </svg>

    <a href="mailto:info@lpc.org.uk">info@lpc.org.uk</a>
  </div>
</section>

         <section class="footer__column">
  <h4>Service Times</h4>
  <ul class="footer__services">
    ${
      branch
        ? (branch.services || "Service times to be confirmed.")
            .split(/\r?\n/)
            .filter((line) => line.trim())
            .map((line) => {
              const [service, ...timing] = line.split(/\s*-\s*/);
              return `
                <li>
                  <span class="service__name">${escapeHtml(service)}</span>
                  ${
                    timing.length
                      ? `<span class="service__time">${escapeHtml(timing.join(" - "))}</span>`
                      : ""
                  }
                </li>
              `;
            })
            .join("")
        : `
          <li>
            <span class="service__name">Sunday Service</span>
            <span class="service__time">
              8:00 AM — Hindi<br>
              9:30 AM — English<br>
              11:00 AM — Malayalam<br>
              4:30 PM — Branches
            </span>
          </li>
          <li>
            <span class="service__name">Cell Prayers</span>
            <span class="service__time">7:30 PM · Monday – Friday</span>
          </li>
          <li>
            <span class="service__name">Sunday School</span>
            <span class="service__time">10:30 AM</span>
          </li>
          <li>
            <span class="service__name">Youth Meetings</span>
            <span class="service__time">12:00 PM · Last Sunday of the month</span>
          </li> 
        `
    }
  </ul>
</section>
        </div>
        <div class="footer__bottom"><span>
          &copy; 2026 London Pentecostal Church | Part of Alpha International Ministries | Charity No : 1126140 | All rights reserved. | <a href="#/volunteers">Team access</a>
        </span></div>
      </div>
    </footer>
  `;
}

function quickItem(iconName, title, text, href = "#/plan-your-visit") {
  return `
    <a class="quick-item" href="${href}">
      <div class="quick-item__icon">${icon(iconName)}</div>
      <div>
        <h3 class="quick-item__title">${title}</h3>
        <p class="quick-item__text">${text}</p>
      </div>
    </a>
  `;
}

function infoCard(title, text, iconName) {
  return `
    <article class="info-card">
      <div class="info-card__icon">${icon(iconName)}</div>
      <h3>${title}</h3>
      <p>${text}</p>
    </article>
  `;
}

function card(title, html) {
  return `
    <article class="content-card">
      <h3>${title}</h3>
      <p>${html}</p>
    </article>
  `;
}

function icon(name) {
  const stroke = "currentColor";
  const map = {
    calendar: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" stroke="${stroke}" stroke-width="1.8"/><path d="M8 3v4M16 3v4M3 10h18" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    marker: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" stroke="${stroke}" stroke-width="1.8"/><circle cx="12" cy="10" r="2.6" stroke="${stroke}" stroke-width="1.8"/></svg>`,
    users: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M17 20v-1.2A3.8 3.8 0 0 0 13.2 15H10.8A3.8 3.8 0 0 0 7 18.8V20" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="3.2" stroke="${stroke}" stroke-width="1.8"/><path d="M4 19.5v-.8A3.2 3.2 0 0 1 7 15.5M20 19.5v-.8A3.2 3.2 0 0 0 17 15.5" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    play: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="${stroke}" stroke-width="1.8"/><path d="m10 8 6 4-6 4V8Z" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    music: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 18V7l9-2v11" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="18" r="2.5" stroke="${stroke}" stroke-width="1.8"/><circle cx="15.5" cy="16" r="2.5" stroke="${stroke}" stroke-width="1.8"/></svg>`,
    book: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" stroke="${stroke}" stroke-width="1.8"/><path d="M8 7h8M8 11h8" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  };
  return map[name] || map.play;
}

function normalizeRoute() {
  const hash =
    window.location.hash ||
    window.location.pathname.replace(/\/$/, "") ||
    "/home";
  const route = hash.replace(/^#/, "").split("?")[0];
  return route.startsWith("/") ? route : `/${route}`;
}

function renderRoute() {
  const route = normalizeRoute();
  const render = routes[route] || getDynamicRouteRenderer(route);
  const app = document.getElementById("app");
  applyRouteTheme(route);
  app.innerHTML = render
    ? render()
    : `
      <section class="page-not-found">
        <div class="container">
          <p class="eyebrow">Page Not Found</p>
          <h1 class="section-title">That route doesn't exist yet.</h1>
          <p class="section-copy">Use the navigation to return to the homepage or another page.</p>
          <p style="margin-top:24px"><a class="btn btn--gold" href="#/home">Back Home</a></p>
        </div>
      </section>
      ${renderFooter()}
    `;

  // The planner owns its return navigation; all other routes share this one.
  if (!app.querySelector('#volunteer-app')) {
    const navigation = document.createElement('div');
    navigation.className = 'container route-return';
    navigation.innerHTML = window.LPCTeamAuth.navigation(adminSession.authenticated ? {admin:true} : null);
    app.prepend(navigation);
    fetch('/api/volunteers/session', {cache:'no-store'})
      .then(response => response.ok ? response.json() : null)
      .then(session => {
        if (session && navigation.isConnected) navigation.innerHTML = window.LPCTeamAuth.navigation(session.actor);
      }).catch(() => {});
  }

  document.querySelectorAll(".primary-nav a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const active =
      route === href.replace(/^#/, "") ||
      (href === "#/ministries" && route === "/ministries");
    link.classList.toggle("is-active", active);
  });

  document.getElementById("site-header").classList.remove("is-open");
  const toggle = document.getElementById("menu-toggle");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Open menu");
  applySiteSettings();
  window.scrollTo({ top: 0, behavior: "instant" });
  initHomeHeroAdmin();
  initPastorAdmin();
  initAssetManager();
  applyImageFraming();
  initBranchAdmin();
  window.LPCVolunteers?.mount();
  applyPageImages(document.getElementById("app"), route);
  initPageImageAdmin();
  initContactForm();
  hydrateCalendarEvents();
  hydrateYouTubePlayers();
  initPageMotion();
  const motion = document.querySelector(".hero-motion");
  const video = document.querySelector(".hero__video");
  if (motion && video) {
    const sync = () => {
      motion.textContent = video.paused ? "Play video" : "Pause video";
      motion.setAttribute(
        "aria-label",
        video.paused ? "Play background video" : "Pause background video",
      );
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      video.pause();
    else {
      video.muted = true;
      video.play().catch(sync);
    }
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    motion.addEventListener("click", () => {
      if (video.paused) video.play().catch(sync);
      else video.pause();
    });
    sync();
  } else if (motion) motion.hidden = true;
}

function getDynamicRouteRenderer(route) {
  if (route === '/lpcadmin/users') return () => adminSession.authenticated ? '<section class="section vs-section"><div id="volunteer-app" data-users-page="true" class="container"><p>Loading users &amp; access…</p></div></section>' : renderAdminLogin();
  if (route === '/volunteers' || route === '/lpcadmin/volunteers') return () => '<section class="section vs-section"><div id="volunteer-app" class="container"><p>Loading volunteer schedules…</p></div></section>';

  if (route === "/lpcadmin/page-images") return renderPageImageAdmin;
  if (route === "/lpcadmin/branches" || route === "/admin/branches")
    return renderBranchAdmin;
  if (route.startsWith("/branches/")) {
    const branch = branchCards.find((b) => b.slug === route.slice(10));
    if (branch) return () => renderBranchPage(branch, branch.image);
  }
  if (route === "/lpcadmin/assets" || route === "/admin/assets")
    return renderAssetManager;
  if (route === "/lpcadmin/pastors" || route === "/admin/pastors")
    return renderPastorAdmin;
  if (route.startsWith("/pastors/"))
    return () => renderPastorProfile(route.slice(9));
  if (/^\/(?:lpcadmin|admin)\/hero\//.test(route)) {
    const key = route.replace(/^\/(?:lpcadmin|admin)\/hero\//, "");
    return () => renderAdminHeroEditor(key);
  }
  return null;
}

function applySiteSettings() {
  const slogan = document.querySelector(".topbar__celebration");
  if (slogan) slogan.textContent = getSiteSettingsConfig().topbarSlogan;
}

function initHomeHeroAdmin() {
  const loginForm = document.getElementById("admin-login-form");
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(loginForm);
    const message = loginForm.querySelector("[data-admin-login-message]");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: String(data.get("username") || ""),
          password: String(data.get("password") || ""),
        }),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({}));
        throw new Error(
          response.status === 401 ? "Website admin username or password is incorrect. Use the separate website admin credentials. If forgotten, open the recovery guidance above." : failure.error || "Unable to sign in. Please try again.",
        );
      }
      adminSession = await response.json();
      await loadHeroImagesConfig();
      renderRoute();
    } catch (error) {
      if (message) message.textContent = error.message || "Login failed";
    }
  });

  document
    .querySelector("[data-admin-logout]")
    ?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await window.LPCTeamAuth.signOut();
      } catch (error) {
        button.disabled = false;
        let status = button.parentElement.querySelector('[data-sign-out-error]');
        if (!status) {
          status = document.createElement('p');
          status.dataset.signOutError = '';
          status.setAttribute('role', 'alert');
          button.parentElement.append(status);
        }
        status.textContent = error.message;
      }
    });

  initAssetPicker();
  initHeroEditorLivePreview();

  const form = document.getElementById("home-hero-form");
  if (!form) {
    initSiteSettingsAdmin();
    initPastorThoughtAdmin();
    initHeroImagesAdmin();
    initHeroImageEditorAdmin();
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const config = {
      video: String(data.get("video") || "").trim(),
      poster:
        String(data.get("poster") || "").trim() || defaultHomeHeroConfig.poster,
      focal: focusNumberToPosition(data.get("focal")),
      mobileFocal: focusNumberToPosition(data.get("mobileFocal")),
      scale: scaleNumberToValue(data.get("scale")),
      mobileScale: scaleNumberToValue(data.get("mobileScale")),
      fit: normalizeFitMode(String(data.get("fit") || "")),
      mobileFit: normalizeFitMode(String(data.get("mobileFit") || "")),
      label:
        String(data.get("label") || "").trim() || defaultHomeHeroConfig.label,
      title:
        String(data.get("title") || "").trim() || defaultHomeHeroConfig.title,
    };
    try {
      await saveHomeHeroConfig(config);
      refreshAfterAdminSave();
    } catch (error) {
      window.alert(error.message);
    }
  });

  form
    .querySelector("[data-reset-home-hero]")
    ?.addEventListener("click", () => {
      saveHomeHeroConfig({ ...defaultHomeHeroConfig }).then(
        refreshAfterAdminSave,
      );
    });

  initHeroImagesAdmin();
  initHeroImageEditorAdmin();
  initPastorThoughtAdmin();
  initSiteSettingsAdmin();
}

function initHeroEditorLivePreview() {
  const homeForm = document.getElementById("home-hero-form");
  if (homeForm) {
    const updateHomePreview = () => {
      const data = new FormData(homeForm);
      const config = {
        video: String(data.get("video") || "").trim(),
        poster:
          String(data.get("poster") || "").trim() ||
          defaultHomeHeroConfig.poster,
        focal: focusNumberToPosition(data.get("focal")),
        mobileFocal: focusNumberToPosition(data.get("mobileFocal")),
        scale: scaleNumberToValue(data.get("scale")),
        mobileScale: scaleNumberToValue(data.get("mobileScale")),
        fit: normalizeFitMode(String(data.get("fit") || "")),
        mobileFit: normalizeFitMode(String(data.get("mobileFit") || "")),
        label:
          String(data.get("label") || "").trim() || defaultHomeHeroConfig.label,
        title:
          String(data.get("title") || "").trim() || defaultHomeHeroConfig.title,
      };
      replaceAdminPreview("home", renderHomeHeroPreviewTile(true, config));
    };
    homeForm.addEventListener("input", updateHomePreview);
    homeForm.addEventListener("change", updateHomePreview);
  }

  const heroForm = document.getElementById("hero-image-editor-form");
  if (heroForm) {
    const key = heroForm.dataset.heroKey;
    const updateHeroPreview = () => {
      if (!key || !heroImageDefaults[key]) return;
      const data = new FormData(heroForm);
      const config = {
        video: String(data.get("video") || "").trim(),
        desktopImage:
          String(data.get("desktopImage") || "").trim() ||
          heroImageDefaults[key].desktopImage,
        mobileImage: String(data.get("mobileImage") || "").trim(),
        desktopFocal: focusNumberToPosition(data.get("desktopFocal")),
        mobileFocal: focusNumberToPosition(data.get("mobileFocal")),
        desktopScale: scaleNumberToValue(data.get("desktopScale")),
        mobileScale: scaleNumberToValue(data.get("mobileScale")),
        desktopFit: normalizeFitMode(String(data.get("desktopFit") || "")),
        mobileFit: normalizeFitMode(String(data.get("mobileFit") || "")),
      };
      replaceAdminPreview(key, renderHeroPreviewTile(key, true, config));
    };
    heroForm.addEventListener("input", updateHeroPreview);
    heroForm.addEventListener("change", updateHeroPreview);
  }
}

function replaceAdminPreview(key, markup) {
  const current = document.querySelector(
    `[data-admin-preview="${CSS.escape(key)}"]`,
  );
  if (!current) return;
  current.outerHTML = markup;
}

function initAssetPicker() {
  document.querySelectorAll("[data-asset-picker]").forEach((button) => {
    if (button.dataset.pickerBound) return;
    button.dataset.pickerBound = "true";
    button.addEventListener("click", () => {
      const field = button.closest(".admin-asset-field");
      const input = field?.querySelector("input");
      if (!input) return;
      openAssetPicker(button.dataset.assetPicker || "image", input);
    });
  });
}

async function openAssetPicker(type, input) {
  const pickerType = type === "video" ? "video" : "image";
  const overlay = document.createElement("div");
  overlay.className = "asset-picker";
  overlay.innerHTML = `
    <div class="asset-picker__dialog" role="dialog" aria-modal="true" aria-label="Select ${pickerType}">
      <div class="asset-picker__header">
        <div>
          <strong>Select ${pickerType === "video" ? "video" : "image"}</strong>
          <span>Choose an existing file. Files used by website JSON are Protected Asset by default and cannot be unprotected.</span>
        </div>
        <div class="asset-picker__actions">
          <label class="asset-picker__upload">
            Upload ${pickerType === "video" ? "video" : "image"}
            <input type="file" data-asset-upload accept="${pickerType === "video" ? ".mp4,.webm,.mov,.m4v,video/*" : ".jpg,.jpeg,.png,.webp,.svg,image/*"}">
          </label>
          <button class="asset-picker__refresh" type="button">Refresh</button>
          <button class="asset-picker__close" type="button" aria-label="Close asset picker">Close</button>
        </div>
      </div>
      <div class="asset-picker__content">
        <p class="asset-picker__status">Loading assets...</p>
      </div>
    </div>
  `;
  document.body.append(overlay);

  const closePicker = () => overlay.remove();
  overlay
    .querySelector(".asset-picker__close")
    ?.addEventListener("click", closePicker);
  overlay
    .querySelector(".asset-picker__refresh")
    ?.addEventListener("click", () => {
      renderAssetPickerItems(overlay, pickerType, input);
    });
  overlay
    .querySelector("[data-asset-upload]")
    ?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await uploadAssetFile(overlay, pickerType, input, file);
    });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePicker();
  });

  renderAssetPickerItems(overlay, pickerType, input);
}

async function renderAssetPickerItems(overlay, pickerType, input) {
  if (overlay.dataset.manager)
    return renderManagedAssets(overlay, pickerType, input);
  const content = overlay.querySelector(".asset-picker__content");
  if (!content) return;
  const uploadsOnly = overlay.dataset.uploadsOnly === "true";
  content.innerHTML = `<p class="asset-picker__status">Loading latest assets...</p>`;

  try {
    const assets = await loadAdminAssets();
    const allItems =
      pickerType === "video" ? assets.videos || [] : assets.images || [];
    const editableCount = allItems.filter((item) => !item.protected).length;
    const items = uploadsOnly
      ? allItems.filter((item) => !item.protected)
      : allItems;
    if (!items.length) {
      content.innerHTML = `
        <div class="asset-picker__toolbar">
          <button class="asset-picker__toggle ${uploadsOnly ? "is-active" : ""}" type="button" data-uploads-toggle>
            ${uploadsOnly ? "Show all assets" : `Show unprotected only (${editableCount})`}
          </button>
          <p class="asset-picker__hint">Protected Asset means the file is used by the website and cannot be removed.</p>
        </div>
        <p class="asset-picker__status">No ${uploadsOnly ? "unprotected " : ""}${pickerType}s found.</p>
      `;
      content
        .querySelector("[data-uploads-toggle]")
        ?.addEventListener("click", () => {
          overlay.dataset.uploadsOnly = uploadsOnly ? "false" : "true";
          renderAssetPickerItems(overlay, pickerType, input);
        });
      return;
    }

    content.innerHTML = `
      <div class="asset-picker__toolbar">
        <button class="asset-picker__toggle ${uploadsOnly ? "is-active" : ""}" type="button" data-uploads-toggle>
          ${uploadsOnly ? "Show all assets" : `Show unprotected only (${editableCount})`}
        </button>
        <p class="asset-picker__hint">Images used by the website are protected. Unused files can be protected for future reuse or deleted.</p>
      </div>
      <div class="asset-picker__grid">
        ${items
          .map((item) => {
            const preview =
              pickerType === "video"
                ? `<video src="${escapeAttribute(item.path)}" muted preload="metadata"></video>`
                : `<img src="${escapeAttribute(item.path)}" alt="">`;
            return `
              <div class="asset-picker__item">
                <button class="asset-picker__select" type="button" data-asset-path="${escapeAttribute(item.path)}">
                  <span class="asset-picker__preview">${preview}</span>
                  <span class="asset-picker__name">${escapeHtml(item.name)}</span>
                  <span class="asset-picker__path">${escapeHtml(item.path)}</span>
                </button>
                ${renderAssetProtectionActions(item)}
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    content.querySelectorAll("[data-asset-path]").forEach((item) => {
      item.addEventListener("click", () => {
        input.value = item.dataset.assetPath || "";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        overlay.remove();
      });
    });
    content
      .querySelector("[data-uploads-toggle]")
      ?.addEventListener("click", () => {
        overlay.dataset.uploadsOnly = uploadsOnly ? "false" : "true";
        renderAssetPickerItems(overlay, pickerType, input);
      });
    content.querySelectorAll("[data-asset-delete]").forEach((item) => {
      item.addEventListener("click", async () => {
        await deleteAssetFile(
          overlay,
          pickerType,
          input,
          item.dataset.assetDelete || "",
        );
      });
    });
    content.querySelectorAll("[data-asset-protect]").forEach((item) => {
      item.addEventListener("click", async () => {
        await updateAssetProtection(
          overlay,
          pickerType,
          input,
          item.dataset.assetProtect || "",
          true,
        );
      });
    });
    content.querySelectorAll("[data-asset-unprotect]").forEach((item) => {
      item.addEventListener("click", async () => {
        await updateAssetProtection(
          overlay,
          pickerType,
          input,
          item.dataset.assetUnprotect || "",
          false,
        );
      });
    });
  } catch (error) {
    content.innerHTML = `<p class="asset-picker__status">Could not load assets. ${escapeHtml(error.message || "")}</p>`;
  }
}

function renderAssetProtectionActions(item) {
  if (item.protection === "protected") {
    return `<span class="asset-picker__protected">Protected Asset</span>`;
  }
  if (item.protection === "user-protected") {
    return `
      <span class="asset-picker__protected">User protected</span>
      <button class="asset-picker__delete" type="button" data-asset-unprotect="${escapeAttribute(item.path)}">Unprotect</button>
    `;
  }
  return `
    <button class="asset-picker__delete" type="button" data-asset-protect="${escapeAttribute(item.path)}">Protect</button>
    <button class="asset-picker__delete" type="button" data-asset-delete="${escapeAttribute(item.path)}">Delete</button>
  `;
}

async function updateAssetProtection(
  overlay,
  pickerType,
  input,
  path,
  protectedValue,
) {
  if (!path) return;
  const response = await fetch("/api/assets/protection", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, protected: protectedValue }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const content = overlay.querySelector(".asset-picker__content");
    if (content)
      content.innerHTML = `<p class="asset-picker__status">Protection update failed. ${escapeHtml(payload.error || "")}</p>`;
    return;
  }
  renderAssetPickerItems(overlay, pickerType, input);
}

async function deleteAssetFile(overlay, pickerType, input, path) {
  if (!path) return;
  if (!window.confirm("Delete this media file? This cannot be undone.")) return;
  const response = await fetch("/api/assets/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const content = overlay.querySelector(".asset-picker__content");
    if (content)
      content.innerHTML = `<p class="asset-picker__status">Delete failed. ${escapeHtml(payload.error || "")}</p>`;
    return;
  }
  if (input.value === path) {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  renderAssetPickerItems(overlay, pickerType, input);
}

async function loadAdminAssets() {
  const response = await fetch(`/api/assets?ts=${Date.now()}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Asset list unavailable");
  return response.json();
}

async function uploadAssetFile(overlay, pickerType, input, file) {
  const content = overlay.querySelector(".asset-picker__content");
  const uploadInput = overlay.querySelector("[data-asset-upload]");
  if (content) {
    content.innerHTML = `<p class="asset-picker__status">Uploading ${escapeHtml(file.name)}...</p>`;
  }

  try {
    const form = new FormData();
    form.append("file", file);
    form.append("type", pickerType);
    const response = await fetch("/api/assets/upload", {
      method: "POST",
      body: form,
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401)
      throw new Error("Please sign in again before uploading.");
    if (!response.ok) throw new Error(payload.error || "Upload failed");

    input.value = payload.path || "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    overlay.remove();
  } catch (error) {
    if (content) {
      content.innerHTML = `<p class="asset-picker__status">Upload failed. ${escapeHtml(error.message || "")}</p>`;
    }
    if (uploadInput) uploadInput.value = "";
  }
}

function initSiteSettingsAdmin() {
  const form = document.getElementById("site-settings-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const config = {
      topbarSlogan:
        String(data.get("topbarSlogan") || "").trim() ||
        defaultSiteSettingsConfig.topbarSlogan,
    };
    await saveSiteSettingsConfig(config);
    renderRoute();
  });
}

function initPastorThoughtAdmin() {
  const form = document.getElementById("pastor-thought-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const config = {
      kicker:
        String(data.get("kicker") || "").trim() ||
        defaultPastorThoughtConfig.kicker,
      title:
        String(data.get("title") || "").trim() ||
        defaultPastorThoughtConfig.title,
      body:
        String(data.get("body") || "").trim() ||
        defaultPastorThoughtConfig.body,
      author:
        String(data.get("author") || "").trim() ||
        defaultPastorThoughtConfig.author,
      date: String(data.get("date") || "").trim(),
      ctaText:
        String(data.get("ctaText") || "").trim() ||
        defaultPastorThoughtConfig.ctaText,
      ctaHref:
        String(data.get("ctaHref") || "").trim() ||
        defaultPastorThoughtConfig.ctaHref,
    };
    await savePastorThoughtConfig(config);
    renderRoute();
  });
}

function initHeroImagesAdmin() {
  const form = document.getElementById("hero-images-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const config = {};
    Object.keys(heroImageDefaults).forEach((key) => {
      config[key] = {
        video: String(data.get(`${key}__video`) || "").trim(),
        desktopImage: String(data.get(`${key}__desktopImage`) || "").trim(),
        mobileImage: String(data.get(`${key}__mobileImage`) || "").trim(),
        desktopFocal: focusNumberToPosition(data.get(`${key}__desktopFocal`)),
        mobileFocal: focusNumberToPosition(data.get(`${key}__mobileFocal`)),
        desktopScale: scaleNumberToValue(data.get(`${key}__desktopScale`)),
        mobileScale: scaleNumberToValue(data.get(`${key}__mobileScale`)),
        desktopFit: normalizeFitMode(
          String(data.get(`${key}__desktopFit`) || ""),
        ),
        mobileFit: normalizeFitMode(
          String(data.get(`${key}__mobileFit`) || ""),
        ),
      };
    });
    await saveHeroImagesConfig(config);
    renderRoute();
  });
}

function initHeroImageEditorAdmin() {
  const form = document.getElementById("hero-image-editor-form");
  if (!form) return;
  const status = form.querySelector("[data-form-status]");
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const key = form.dataset.heroKey;
    if (!key || !heroImageDefaults[key]) return;
    const data = new FormData(form);
    setAdminFormStatus(status, "saving", "Saving hero...");
    if (submitButton) submitButton.disabled = true;
    try {
      await saveHeroImagesConfig({
        [key]: {
          video: String(data.get("video") || "").trim(),
          desktopImage:
            String(data.get("desktopImage") || "").trim() ||
            heroImageDefaults[key].desktopImage,
          mobileImage: String(data.get("mobileImage") || "").trim(),
          desktopFocal: focusNumberToPosition(data.get("desktopFocal")),
          mobileFocal: focusNumberToPosition(data.get("mobileFocal")),
          desktopScale: scaleNumberToValue(data.get("desktopScale")),
          mobileScale: scaleNumberToValue(data.get("mobileScale")),
          desktopFit: normalizeFitMode(String(data.get("desktopFit") || "")),
          mobileFit: normalizeFitMode(String(data.get("mobileFit") || "")),
        },
      });
      setAdminFormStatus(
        status,
        "success",
        `${heroLabel(key)} hero saved successfully. Returning to admin...`,
      );
      window.setTimeout(() => {
        window.location.hash = "#/lpcadmin";
      }, 900);
    } catch (error) {
      setAdminFormStatus(
        status,
        "error",
        `Save failed: ${error.message || "Please try again."}`,
      );
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

function setAdminFormStatus(element, state, message) {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = state;
}

function goHomeAndRender() {
  if (window.location.hash === "#/home") {
    renderRoute();
    return;
  }
  window.location.hash = "#/home";
}

function refreshAfterAdminSave() {
  if (normalizeRoute().startsWith("/admin")) {
    renderRoute();
    return;
  }
  if (normalizeRoute().startsWith("/lpcadmin/hero/")) {
    window.location.hash = "#/lpcadmin";
    return;
  }
  if (normalizeRoute().startsWith("/lpcadmin")) {
    renderRoute();
    return;
  }
  goHomeAndRender();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function applyRouteTheme(route) {
  document.body.classList.toggle(
    "is-red-header-sample",
    new URLSearchParams(location.search).get("header") === "lpc-red",
  );
  const branch = branchCards.find((item) => route === `/branches/${item.slug}`);
  const theme = branch
    ? {
        logo: branch.logo,
        primary: branch.color,
        mid: `color-mix(in srgb, ${branch.color} 80%, #000)`,
        dark: `color-mix(in srgb, ${branch.color} 45%, #000)`,
        accent: branch.accent,
        soft: branch.soft,
      }
    : defaultTheme;

  document.body.classList.toggle("is-branch-page", Boolean(branch));
  const root = document.documentElement;
  root.style.setProperty("--theme-primary", theme.primary);
  root.style.setProperty("--theme-mid", theme.mid);
  root.style.setProperty("--theme-dark", theme.dark);
  root.style.setProperty("--theme-accent", theme.accent);
  root.style.setProperty("--theme-soft", theme.soft);

  const logo = document.querySelector(".brand__logo");
  if (logo) {
    logo.setAttribute("src", theme.logo);
    logo.setAttribute(
      "alt",
      branch ? `${branch.churchName} logo` : "London Pentecostal Church logo",
    );
  }

  const brand = document.querySelector(".brand");
  if (brand) {
    brand.setAttribute("href", branch ? `#/branches/${branch.slug}` : "#/home");
    brand.setAttribute(
      "aria-label",
      branch ? `${branch.churchName} home` : "London Pentecostal Church home",
    );
  }

  const wordmark = document.querySelector(".brand__wordmark");
  if (wordmark) {
    const lines = branch?.wordmark || ["London", "Pentecostal", "Church"];
    wordmark.innerHTML = lines
      .map((line) => `<span>${escapeHtml(line)}</span>`)
      .join("");
  }
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", async () => {
  const toggle = document.getElementById("menu-toggle");
  const header = document.getElementById("site-header");
  toggle?.addEventListener("click", () => {
    const open = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  await loadHomeHeroConfig();
  await loadHeroImagesConfig();
  await loadPastorThoughtConfig();
  await loadSiteSettingsConfig();
  await loadAdminSession();
  await loadPastors();
  await loadBranches();
  try {
    const response = await fetch("/api/page-images", { cache: "no-store" });
    if (response.ok) pageImages = await response.json();
  } catch {}
  await loadImageFraming();
  document.addEventListener(
    "load",
    (event) => {
      if (event.target.tagName === "IMG") applyImageFraming(event.target);
    },
    true,
  );
  renderRoute();
});

async function loadConfiguration(name) {
  try {
    const response = await fetch(`/api/${name}?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (
      response.ok &&
      response.headers.get("content-type")?.includes("application/json")
    )
      return response;
  } catch {
    /* The published site can use its static configuration. */
  }
  return fetch(`./assets/data/${name}.json`, { cache: "no-cache" });
}

async function loadHomeHeroConfig() {
  try {
    const response = await loadConfiguration("home-hero");
    if (!response.ok) return;
    serverHomeHeroConfig = await response.json();
    localStorage.setItem(
      homeHeroStorageKey,
      JSON.stringify(serverHomeHeroConfig),
    );
  } catch {
    serverHomeHeroConfig = null;
  }
}

async function loadHeroImagesConfig() {
  try {
    const response = await loadConfiguration("hero-images");
    if (!response.ok) return;
    serverHeroImagesConfig = await response.json();
  } catch {
    serverHeroImagesConfig = {};
  }
}

async function loadPastorThoughtConfig() {
  try {
    const response = await loadConfiguration("pastor-thought");
    if (!response.ok) return;
    pastorThoughtConfig = await response.json();
  } catch {
    pastorThoughtConfig = null;
  }
}

async function loadSiteSettingsConfig() {
  try {
    const response = await loadConfiguration("site-settings");
    if (!response.ok) return;
    siteSettingsConfig = await response.json();
  } catch {
    siteSettingsConfig = null;
  }
}

async function loadAdminSession() {
  try {
    const response = await fetch(`/api/admin/session?ts=${Date.now()}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    adminSession = await response.json();
  } catch {
    adminSession = { authenticated: false };
  }
}

async function saveHomeHeroConfig(config) {
  const response = await fetch("/api/home-hero", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok)
    throw new Error(
      "Could not save the homepage. Please sign in again and retry.",
    );
  serverHomeHeroConfig = await response.json();
  localStorage.removeItem(homeHeroStorageKey);
}

async function saveHeroImagesConfig(config) {
  const response = await fetch("/api/hero-images", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error("Could not save hero images");
  serverHeroImagesConfig = await response.json();
}

async function savePastorThoughtConfig(config) {
  pastorThoughtConfig = config;
  const response = await fetch("/api/pastor-thought", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error("Could not publish pastor thought");
  pastorThoughtConfig = await response.json();
}

async function saveSiteSettingsConfig(config) {
  siteSettingsConfig = config;
  const response = await fetch("/api/site-settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!response.ok) throw new Error("Could not save site settings");
  siteSettingsConfig = await response.json();
  applySiteSettings();
}

async function hydrateYouTubePlayers() {
  const players = [
    ...document.querySelectorAll(".youtube-preview[data-youtube-handle]"),
  ];
  if (!players.length) return;

  const apiKey =
    window.LPC_YOUTUBE_API_KEY ||
    localStorage.getItem("LPC_YOUTUBE_API_KEY") ||
    document
      .querySelector('meta[name="youtube-api-key"]')
      ?.getAttribute("content");

  await Promise.all(
    players.map(async (player) => {
      const handle = player.dataset.youtubeHandle;
      const channelUrl = player.dataset.youtubeUrl;
      const title = player.dataset.youtubeTitle || "Branch media";

      let localVideo = await findLocalLatestVideo(handle, channelUrl);
      if (!localVideo) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (!player.isConnected) return;
        localVideo = await findLocalLatestVideo(handle, channelUrl);
      }
      if (!player.isConnected) return;
      if (localVideo) {
        prioritiseWatchPlayer(player, localVideo.mode || "Latest video");
        renderYouTubeVideoPreview(player, {
          title,
          channelUrl,
          video: localVideo,
          mode: localVideo.mode || "Latest video",
          autoplaySilent: player.dataset.youtubeAutoplay === "silent",
        });
        player.dataset.youtubeMode = localVideo.mode || "Latest video";
        return;
      }

      if (!apiKey) {
        renderYouTubeChannelPreview(player, {
          title,
          channelUrl,
          mode: "YouTube Channel",
          message: "Watch our services on YouTube",
          detail:
            "Explore worship, messages and recent services from our church family.",
        });
        return;
      }

      try {
        const channelId = await resolveYouTubeChannelId(handle, apiKey);
        const liveVideo = await findYouTubeVideo(channelId, apiKey, "live");
        const latestVideo =
          liveVideo || (await findYouTubeVideo(channelId, apiKey, "latest"));

        if (!latestVideo) {
          renderYouTubeChannelPreview(player, {
            title,
            channelUrl,
            mode: "YouTube Channel",
            message:
              "No public live stream or recent video was returned for this channel.",
            detail:
              "Open the branch channel to browse the full media collection.",
          });
          return;
        }

        const mode = liveVideo ? "Live now" : "Latest video";
        prioritiseWatchPlayer(player, mode);
        renderYouTubeVideoPreview(player, {
          title,
          channelUrl,
          video: latestVideo,
          mode,
          autoplaySilent: player.dataset.youtubeAutoplay === "silent",
        });
        player.dataset.youtubeMode = mode;
      } catch (error) {
        renderYouTubeChannelPreview(player, {
          title,
          channelUrl,
          mode: "YouTube Channel",
          message: "Could not load dynamic YouTube media.",
          detail: "Open the branch channel to watch the latest public media.",
        });
      }
    }),
  );
}

async function findLocalLatestVideo(handle, channelUrl) {
  try {
    const url = new URL("/api/youtube/latest", window.location.origin);
    url.search = new URLSearchParams({ handle, channelUrl });
    const response = await fetch(url);
    if (!response.ok) return null;
    const video = await response.json();
    return video?.id ? video : null;
  } catch (error) {
    return null;
  }
}

async function resolveYouTubeChannelId(handle, apiKey) {
  const cleanHandle = handle.replace(/^@/, "");
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.search = new URLSearchParams({
    part: "id",
    forHandle: cleanHandle,
    key: apiKey,
  });

  const response = await fetch(url);
  if (!response.ok) throw new Error("Channel lookup failed");
  const data = await response.json();
  const channelId = data.items?.[0]?.id;
  if (!channelId) throw new Error("Channel not found");
  return channelId;
}

async function findYouTubeVideo(channelId, apiKey, mode) {
  const params = {
    part: "id,snippet",
    channelId,
    maxResults: "1",
    type: "video",
    key: apiKey,
  };

  if (mode === "live") {
    params.eventType = "live";
  } else {
    params.order = "date";
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.search = new URLSearchParams(params);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`${mode} video lookup failed`);
  const data = await response.json();
  const item = data.items?.[0];
  if (!item?.id?.videoId) return null;
  return {
    id: item.id.videoId,
    title: item.snippet?.title || "Watch on YouTube",
    thumbnail:
      item.snippet?.thumbnails?.high?.url ||
      item.snippet?.thumbnails?.medium?.url ||
      "",
  };
}

let youtubePlayerApiPromise;
function loadYouTubePlayerApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!youtubePlayerApiPromise)
    youtubePlayerApiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      document.head.append(script);
    });
  return youtubePlayerApiPromise;
}

function renderYouTubeVideoPreview(
  player,
  { title, channelUrl, video, mode, autoplaySilent = false },
) {
  const watchUrl =
    "https://www.youtube.com/watch?v=" + encodeURIComponent(video.id);
  player.innerHTML = '<div class="youtube-video-mount"></div>';
  const mount = player.firstElementChild;
  const preview = document.createElement("a");
  preview.className = "youtube-video-still";
  preview.href = watchUrl;
  preview.target = "_blank";
  preview.rel = "noopener";
  preview.setAttribute("aria-label", "Watch " + title + " on YouTube");
  const image = document.createElement("img");
  image.src =
    video.thumbnail ||
    "https://i.ytimg.com/vi/" + encodeURIComponent(video.id) + "/hqdefault.jpg";
  image.alt = video.title || title;
  const caption = document.createElement("span");
  caption.textContent = "Watch on YouTube ↗";
  preview.append(image, caption);
  player.append(preview);
  let embeddedPlayer;
  let failed = false;
  const fallback = () => {
    failed = true;
    preview.hidden = false;
    embeddedPlayer?.destroy();
    mount.remove();
  };
  const timeout = setTimeout(fallback, 15000);
  loadYouTubePlayerApi()
    .then((YT) => {
      if (failed || !mount.isConnected) return;
      embeddedPlayer = new YT.Player(mount, {
        videoId: video.id,
        playerVars: {
          autoplay: autoplaySilent ? 1 : 0,
          mute: autoplaySilent ? 1 : 0,
          playsinline: 1,
          controls: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (!autoplaySilent) {
              clearTimeout(timeout);
              preview.hidden = true;
            }
          },
          onStateChange: (event) => {
            if (event.data === 1) {
              clearTimeout(timeout);
              preview.hidden = true;
            }
          },
          onError: () => {
            clearTimeout(timeout);
            fallback();
          },
        },
      });
    })
    .catch(() => {
      clearTimeout(timeout);
      fallback();
    });
}

function renderYouTubeChannelPreview(
  player,
  { channelUrl, mode, message, detail },
) {
  player.innerHTML = `
    <a class="youtube-preview__button" href="${channelUrl}" target="_blank" rel="noopener" aria-label="Open YouTube channel">
      <span class="youtube-preview__shade"></span>
      <span class="youtube-play-mark">${icon("play")}</span>
      <span class="youtube-preview__text">
        <strong>${message}</strong>
        <span>${detail}</span>
      </span>
      <span class="youtube-preview__mode">${mode}</span>
    </a>
  `;
}

let disposePageMotion = () => {};
function initPageMotion() {
  disposePageMotion();
  const page = document.querySelector(".page");
  if (!page) return;
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  let observer = null;
  let frame = 0;
  const header = document.getElementById("site-header");
  const hero = page.querySelector(".hero");
  const targets = page.querySelectorAll(
    ".section-heading, .branch-card, .media-section__header, .media-section__body, .social-card, .team-ribbon, .welcome-banner, .info-card, .content-card, .about-photo",
  );
  function update() {
    frame = 0;
    header?.classList.toggle("is-scrolled", window.scrollY > 60);
    if (hero && !preference.matches && window.innerWidth > 760) {
      const progress = Math.min(Math.max(window.scrollY, 0), hero.offsetHeight);
      hero.style.setProperty("--hero-drift", `${progress * 0.16}px`);
    } else hero?.style.setProperty("--hero-drift", "0px");
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  function configure() {
    observer?.disconnect();
    targets.forEach((el) => el.classList.remove("will-reveal", "is-revealed"));
    if (!preference.matches && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-revealed");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
      );
      targets.forEach((el) => {
        // Above-the-fold content stays visible; only upcoming sections reveal.
        if (el.getBoundingClientRect().top >= window.innerHeight - 24) {
          el.classList.add("will-reveal");
          const index = Array.from(el.parentElement.children).indexOf(el);
          el.style.setProperty(
            "--reveal-delay",
            `${Math.min(index, 3) * 75}ms`,
          );
          observer.observe(el);
        }
      });
    }
    update();
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  preference.addEventListener("change", configure);
  configure();
  disposePageMotion = () => {
    observer?.disconnect();
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    preference.removeEventListener("change", configure);
    header?.classList.remove("is-scrolled");
  };
}

async function loadPastors() {
  try {
    const response = await loadConfiguration("pastors");
    if (response.ok) applyPastorConfig(await response.json());
  } catch {}
}
function renderPastorProfile(id) {
  const pastor = pastors.find((p) => p.id === id);
  if (!pastor)
    return (
      '<section class="section"><div class="container"><h1>Pastor profile unavailable</h1><a href="#/pastors">Back to pastors</a></div></section>' +
      renderFooter()
    );
  return (
    '<article class="page"><section class="section"><div class="container pastor-profile"><a href="#/pastors">Back to pastors</a><h1 class="section-title">' +
    escapeHtml(pastor.name) +
    "</h1><p>" +
    escapeHtml(pastor.role) +
    "</p>" +
    (pastor.image
      ? '<img class="pastor-profile__photo" src="' +
        escapeAttribute(pastor.image) +
        '" alt="' +
        escapeAttribute(pastor.name) +
        '">'
      : "") +
    '<p class="pastor-introduction">' +
    escapeHtml(pastor.intro || "An introduction will be added soon.") +
    "</p></div></section>" +
    renderFooter() +
    "</article>"
  );
}
function renderPastorAdmin() {
  if (!adminSession.authenticated) return renderAdminLogin();
  return `<section class="section pastor-admin-page"><div class="container"><a href="#/lpcadmin" class="admin-back-link">← Back to admin</a><div class="admin-panel__header"><div><h1 class="section-title">Associate Pastors</h1><p>Choose a pastor to edit their profile. Save all changes when ready.</p></div><a class="btn btn--outline" href="#/pastors">View website profiles</a></div><form class="admin-form" id="pastors-form"><div class="pastor-admin-toolbar"><span>${Object.keys(pastorConfig.people).length} pastor profiles</span><button type="button" class="btn btn--outline" id="add-pastor">+ Add pastor</button></div><div id="pastor-editor-list">${Object.entries(pastorConfig.people).map(([id,p]) => renderPastorFields(id,p)).join("")}</div><div class="admin-form__actions pastor-admin-savebar"><span data-pastor-save-status>All changes saved</span><button type="submit" class="btn btn--gold">Save all changes</button></div><p role="status" aria-live="polite" id="pastors-message"></p></form></div></section>${renderFooter()}`;
}
function renderPastorFields(id, p) {
  const initials = (p.name || "New pastor").split(/\s+/).filter(Boolean).slice(0,2).map(word => word[0]).join("");
  return `<details class="pastor-admin-card" data-pastor-id="${escapeAttribute(id)}" ${p.name ? "" : "open"}><summary><span class="pastor-admin-portrait"><img data-pastor-preview src="${escapeAttribute(p.image || "")}" alt="" ${p.image ? "" : "hidden"}><span data-pastor-initials ${p.image ? "hidden" : ""}>${escapeHtml(initials)}</span></span><span class="pastor-admin-identity"><strong data-pastor-title>${escapeHtml(p.name || "New associate pastor")}</strong><small data-pastor-role>${escapeHtml(p.role || "Associate Pastor")}</small></span><span class="pastor-admin-edit-label">Edit details</span></summary><div class="pastor-editor"><div class="pastor-admin-basics"><label>Name<input name="name" required maxlength="150" value="${escapeAttribute(p.name || "")}"></label><label>Role<input name="role" required maxlength="150" value="${escapeAttribute(p.role || "Associate Pastor")}"></label></div><label class="pastor-admin-photo-control">Profile photo${renderAssetPickerInput({ name: "image", value: p.image || "", placeholder: "Choose a photo" }).replace('type="text"', 'type="hidden"').replace("Browse images", "Change photo")}</label><label>Introduction<textarea name="intro" rows="3" maxlength="5000" placeholder="A short introduction for the website">${escapeHtml(p.intro || "")}</textarea></label><div class="pastor-admin-card-actions"><button type="button" class="btn btn--outline" data-remove-pastor>Remove profile</button><button type="button" class="btn btn--outline" data-close-pastor>Done editing</button></div></div></details>`;
}
function initPastorAdmin() {
  const form = document.getElementById("pastors-form");
  if (!form) return;
  const dirty = () => { form.querySelector('[data-pastor-save-status]').textContent = "Unsaved changes"; };
  form.addEventListener("input", event => {
    const card = event.target.closest('[data-pastor-id]');
    if (!card) return;
    dirty();
    if (event.target.name === "name") card.querySelector('[data-pastor-title]').textContent = event.target.value || "New associate pastor";
    if (event.target.name === "role") card.querySelector('[data-pastor-role]').textContent = event.target.value || "Associate Pastor";
    if (event.target.name === "image") {
      const image = card.querySelector('[data-pastor-preview]');
      image.src = event.target.value; image.hidden = !event.target.value;
      card.querySelector('[data-pastor-initials]').hidden = !!event.target.value;
    }
  });
  form.addEventListener("invalid", event => { const card = event.target.closest('[data-pastor-id]'); if (card) card.open = true; }, true);
  form.addEventListener("click", (event) => {
    if (event.target.closest('[data-close-pastor]')) event.target.closest('[data-pastor-id]').open = false;
    const remove = event.target.closest("[data-remove-pastor]");
    if (
      remove &&
      confirm("Remove this profile? Save all changes to update the website.")
    )
      { remove.closest("[data-pastor-id]").remove(); dirty(); }
    if (event.target.closest("#add-pastor")) {
      document
        .getElementById("pastor-editor-list")
        .insertAdjacentHTML(
          "beforeend",
          renderPastorFields("pastor-" + crypto.randomUUID(), {}),
        );
      initAssetPicker();
      dirty();
      form.querySelector("[data-pastor-id]:last-child input").focus();
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = document.getElementById("pastors-message");
    const button = form.querySelector('[type="submit"]');
    const people = {};
    form.querySelectorAll("[data-pastor-id]").forEach((row) => {
      const field = (name) =>
        row.querySelector('[name="' + name + '"]').value.trim();
      people[row.dataset.pastorId] = {
        name: field("name"),
        role: field("role"),
        image: field("image"),
        intro: field("intro"),
      };
    });
    button.disabled = true;
    message.textContent = "Saving pastors...";
    try {
      const response = await fetch("/api/pastors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ people }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Could not save. Please sign in again and retry.",
        );
      applyPastorConfig(result);
      form.querySelector("[data-pastor-save-status]").textContent = "All changes saved";
      message.textContent = "Pastors saved. Your website is updated.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

function formatAssetSize(bytes) {
  return bytes >= 1048576
    ? (bytes / 1048576).toFixed(1) + " MB"
    : Math.ceil((bytes || 0) / 1024) + " KB";
}
function renderAssetManager() {
  if (!adminSession.authenticated) return renderAdminLogin();
  return (
    '<section class="section"><div class="container"><a href="#/lpcadmin">Back to admin</a><h1 class="section-title">Asset Library</h1><p>Uploaded files are permanently deleted to free storage. Original website files can be removed from the library; their packaged copies remain until a future site rebuild. Deleting a file may affect older backups.</p><div id="asset-manager" data-manager="true"><div class="asset-picker__toolbar"><label>Search images<input type="search" id="asset-search" placeholder="File name"></label><label>Show<select id="asset-filter"><option value="all">All images</option><option value="unused">Unused images</option><option value="upload">Uploaded images</option></select></label><label class="btn btn--gold">Upload image<input type="file" data-asset-upload accept=".jpg,.jpeg,.png,.webp" hidden></label><button type="button" class="btn btn--outline" id="asset-refresh">Refresh</button></div><p id="asset-summary" role="status"></p><div class="asset-picker__content" aria-live="polite"></div></div></div></section>' +
    renderFooter()
  );
}
function initAssetManager() {
  const manager = document.getElementById("asset-manager");
  if (!manager) return;
  const input = document.createElement("input");
  const refresh = () => renderManagedAssets(manager, "image", input);
  manager.querySelector("#asset-search").addEventListener("input", refresh);
  manager.querySelector("#asset-filter").addEventListener("change", refresh);
  manager.querySelector("#asset-refresh").addEventListener("click", refresh);
  manager
    .querySelector("[data-asset-upload]")
    .addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (file) await uploadAssetFile(manager, "image", input, file);
      event.target.value = "";
    });
  refresh();
}
async function renderManagedAssets(manager, type, input) {
  const content = manager.querySelector(".asset-picker__content");
  const requestId = (manager.assetRequestId || 0) + 1;
  manager.assetRequestId = requestId;
  try {
    const library = await loadAdminAssets();
    if (manager.assetRequestId !== requestId) return;
    const all = library.images || [];
    const search = manager.querySelector("#asset-search").value.toLowerCase();
    const filter = manager.querySelector("#asset-filter").value;
    const items = all.filter(
      (a) =>
        a.name.toLowerCase().includes(search) &&
        (filter !== "unused" || a.deletable) &&
        (filter !== "upload" || a.source === "upload"),
    );
    manager.querySelector("#asset-summary").textContent =
      all.length +
      " images · " +
      formatAssetSize(all.reduce((n, a) => n + (a.size || 0), 0)) +
      " · " +
      all.filter((a) => a.deletable).length +
      " unused";
    content.innerHTML = items.length
      ? '<div class="asset-picker__grid">' +
        items
          .map(
            (a) =>
              '<div class="asset-picker__item"><span class="asset-picker__preview"><img loading="eager" referrerpolicy="strict-origin-when-cross-origin" src="' +
              escapeAttribute(a.path) +
              '" alt=""></span><strong class="asset-picker__name">' +
              escapeHtml(a.name) +
              "</strong><p>" +
              formatAssetSize(a.size) +
              " · " +
              (a.source === "upload" ? "Uploaded" : "Original website file") +
              "</p>" +
              renderAssetProtectionActions(a) +
              '<button type="button" class="btn btn--outline" data-image-framing="' +
              escapeAttribute(a.path) +
              '">Edit framing</button></div>',
          )
          .join("") +
        "</div>"
      : "<p>No matching images.</p>";
    applyImageFraming(content);
    content
      .querySelectorAll("[data-image-framing]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          openImageFraming(button.dataset.imageFraming),
        ),
      );
    content
      .querySelectorAll("[data-asset-delete]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          deleteAssetFile(manager, type, input, button.dataset.assetDelete),
        ),
      );
    content
      .querySelectorAll("[data-asset-protect]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          updateAssetProtection(
            manager,
            type,
            input,
            button.dataset.assetProtect,
            true,
          ),
        ),
      );
    content
      .querySelectorAll("[data-asset-unprotect]")
      .forEach((button) =>
        button.addEventListener("click", () =>
          updateAssetProtection(
            manager,
            type,
            input,
            button.dataset.assetUnprotect,
            false,
          ),
        ),
      );
  } catch (error) {
    content.textContent = "Could not load images. " + error.message;
  }
}

let branchRevision = "";
let branchLoadError = "";
async function loadBranches() {
  try {
    const r = await fetch("/api/branches?ts=" + Date.now(), {
      cache: "no-store",
    });
    if (!r.ok || !r.headers.get("content-type")?.includes("application/json"))
      throw new Error("Saved branch data could not be loaded.");
    const data = await r.json();
    const rev = r.headers.get("x-config-revision");
    if (!rev) throw new Error("Please reload to use the latest admin version.");
    applyBranchConfig(data);
    branchRevision = rev;
    branchLoadError = "";
  } catch (error) {
    branchRevision = "";
    branchLoadError = error.message;
  }
}
function renderBranchAdmin() {
  if (!adminSession.authenticated) return renderAdminLogin();
  if (!branchRevision)
    return (
      '<section class="section"><div class="container"><h1>Branch data unavailable</h1><p>' +
      escapeHtml(branchLoadError) +
      " Editing is disabled to protect your saved details. Reload and try again.</p></div></section>" +
      renderFooter()
    );
  return (
    '<section class="section"><div class="container"><a href="#/lpcadmin">Back to admin</a><h1 class="section-title">Manage branches</h1><p>Add or remove branches and update their details. Save branches to publish your changes.</p><button type="button" class="btn btn--outline" id="check-branch-recovery">Check backups for missing details</button><div id="branch-recovery" aria-live="polite"></div><form id="branches-form" class="admin-form"><div id="branch-editor-list">' +
    Object.entries(branchConfig.branches)
      .map(([slug, b]) => renderBranchFields(slug, b))
      .join("") +
    '</div><div class="admin-form__actions"><button type="button" class="btn btn--outline" id="add-branch">Add branch</button><button type="submit" class="btn btn--gold">Save branches</button></div><p id="branches-message" role="status"></p></form></div></section>' +
    renderFooter()
  );
}
function renderBranchFields(slug, b) {
  b = {
    ...b,
    ...getBranchMedia({ ...b, slug }),
    facebookUrl: Object.hasOwn(b, "facebookUrl")
      ? b.facebookUrl
      : getBranchMedia({ ...b, slug }).socials.find(
          (item) => item[0] === "Facebook",
        )?.[1] || "",
    instagramUrl: Object.hasOwn(b, "instagramUrl")
      ? b.instagramUrl
      : getBranchMedia({ ...b, slug }).socials.find(
          (item) => item[0] === "Instagram",
        )?.[1] || "",
  };
  const text = (key, label, required = false) =>
    "<label>" +
    label +
    '<input name="' +
    key +
    '" maxlength="200" ' +
    (required ? "required" : "") +
    ' value="' +
    escapeAttribute(b[key] || "") +
    '"></label>';
  return (
    '<details class="branch-editor-card" ' +
    (!b.name ? "open" : "") +
    ' data-branch-slug="' +
    escapeAttribute(slug) +
    '" style="--branch-color:' +
    escapeAttribute(b.color || "#1f59cb") +
    '"><summary><span class="branch-editor-icon">' +
    (b.logo ? '<img src="' + escapeAttribute(b.logo) + '" alt="">' : "⌂") +
    "</span><span><strong data-branch-title>" +
    escapeHtml(b.name || "New branch") +
    "</strong><small>" +
    escapeHtml(b.churchName || "Add branch details") +
    '</small></span><span class="branch-admin-colour-dot" aria-hidden="true"></span><span class="branch-editor-chevron">⌄</span></summary><div class="pastor-editor branch-editor-fields">' +
    text("name", "Branch name", true) +
    text("churchName", "Church name", true) +
    text("subtitle", "Label") +
    '<label>Branch colour<span class="admin-colour-control"><input aria-label="Choose branch colour" name="color" type="color" value="' +
    escapeAttribute(b.color || "#1f59cb") +
    '"><output data-colour-value>' + escapeHtml(b.color || "#1f59cb") + '</output></span></label><label>Logo' +
    renderAssetPickerInput({ name: "logo", value: b.logo || "" }) +
    "</label><label>Branch photo" +
    renderAssetPickerInput({ name: "image", value: b.image || "" }) +
    "</label>" +
    ["summary", "address", "services", "contact"]
      .map(
        (key) =>
          "<label>" +
          {
            summary: "Introduction",
            address: "Address",
            services: "Service times",
            contact: "Contact details",
          }[key] +
          '<textarea name="' +
          key +
          '" maxlength="5000" rows="3">' +
          escapeHtml(b[key] || "") +
          "</textarea></label>",
      )
      .join("") +
    "<h3>Watch dashboard and social links</h3>" +
    text("youtubeUrl", "YouTube channel URL") +
    text("videoUrl", "YouTube video or livestream URL") +
    text("facebookUrl", "Facebook URL") +
    text("instagramUrl", "Instagram URL") +
    '<label>Video playback<select name="autoplay"><option value="silent" ' +
    (b.autoplay !== "click" ? "selected" : "") +
    '>Muted autoplay</option><option value="click" ' +
    (b.autoplay === "click" ? "selected" : "") +
    '>Play when clicked</option></select></label><p>Paste a specific YouTube video or live link for the preview. Channel links automatically preview the latest service; a specific video link overrides this.</p><a href="#/branches/' +
    slug +
    '">View branch page</a><a href="#/watch">View Watch dashboard</a><button type="button" class="btn btn--outline" data-remove-branch>Remove branch</button></div></details>'
  );
}
function pageBodyImages(root) {
  return [...root.querySelectorAll("img")].filter(
    (image) =>
      !image.closest(".footer,.branch-card,.hero,.subhero") &&
      !/\/team\//.test(image.getAttribute("src") || ""),
  );
}
function applyPageImages(root, route) {
  if (
    !root ||
    route.includes("admin") ||
    route.startsWith("/branches") ||
    route.startsWith("/pastors")
  )
    return;
  pageBodyImages(root).forEach((image) => {
    const original = image.getAttribute("src");
    const replacement = pageImages[route]?.[original];
    if (replacement) image.src = replacement;
  });
}
function renderPageImageAdmin() {
  if (!adminSession.authenticated) return renderAdminLogin();
  const pages = [
    "home",
    "about",
    "ministries",
    "youth",
    "plan-your-visit",
    "watch",
    "contact",
  ];
  return (
    '<section class="section"><div class="container"><a href="#/lpcadmin">Back to admin</a><h1>Images within pages</h1><p>Edit page images here. Hero images use the hero editor; pastors and branches use their own editors. Choose an image from the library, then save.</p><form id="page-images-form" class="admin-form">' +
    pages
      .map((page) => {
        const route = "/" + page,
          root = document.createElement("div");
        root.innerHTML = routes[route]();
        const images = [
          ...new Map(
            pageBodyImages(root).map((image) => [
              image.getAttribute("src"),
              image,
            ]),
          ).values(),
        ];
        return (
          '<details class="branch-editor-card"><summary><strong>' +
          escapeHtml(heroLabel(page)) +
          '</strong><span class="branch-editor-chevron">⌄</span></summary><div class="branch-editor-fields"><a class="btn btn--outline" href="#/lpcadmin/hero/' +
          page +
          '">Edit hero image / video</a>' +
          images
            .map((image) => {
              const original = image.getAttribute("src"),
                current = pageImages[route]?.[original] || original;
              return (
                '<div class="page-image-slot" data-page="' +
                route +
                '" data-original="' +
                escapeAttribute(original) +
                '"><img src="' +
                escapeAttribute(current) +
                '" alt="' +
                escapeAttribute(image.alt) +
                '"><label>' +
                escapeHtml(image.alt || "Page image") +
                renderAssetPickerInput({ name: "image", value: current }) +
                "</label></div>"
              );
            })
            .join("") +
          (images.length
            ? ""
            : "<p>No additional page images. Use the hero editor above.</p>") +
          "</div></details>"
        );
      })
      .join("") +
    '<button class="btn btn--gold" type="submit">Save page images</button><p role="status" id="page-images-status"></p></form></div></section>' +
    renderFooter()
  );
}
function initPageImageAdmin() {
  const form = document.getElementById("page-images-form");
  if (!form) return;
  initAssetPicker();
  form.addEventListener("input", (event) => {
    const slot = event.target.closest(".page-image-slot");
    if (slot) slot.querySelector("img").src = event.target.value;
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const config = structuredClone(pageImages),
      status = document.getElementById("page-images-status"),
      button = form.querySelector('[type="submit"]');
    form.querySelectorAll(".page-image-slot").forEach((slot) => {
      config[slot.dataset.page] ||= {};
      config[slot.dataset.page][slot.dataset.original] = slot
        .querySelector("input")
        .value.trim();
    });
    button.disabled = true;
    try {
      const response = await fetch("/api/page-images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw Error("Page image service is unavailable.");
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Save failed");
      pageImages = data;
      status.textContent = "Page images saved.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
function initContactForm() {
  const form = document.querySelector(".contact-form");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'),
      status = form.querySelector("[data-contact-status]");
    button.disabled = true;
    status.textContent = "Sending your message…";
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const data = await response.json();
      if (!response.ok || !data.sent)
        throw Error(data.error || "Your message could not be sent.");
      form.reset();
      status.textContent = "Your message has been sent to the church office.";
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
function initBranchAdmin() {
  const form = document.getElementById("branches-form");
  if (!form) return;
  const tools = document.createElement("div");
  tools.className = "admin-form__actions";
  tools.innerHTML =
    '<button type="button" class="btn btn--outline" data-export-branches>Export saved JSON</button><label class="btn btn--outline">Import JSON<input type="file" accept=".json,application/json" data-import-branches hidden></label>';
  form.before(tools);
  tools.querySelector("[data-export-branches]").onclick = () => {
    const blob = new Blob([JSON.stringify(branchConfig, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = "branches.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  tools
    .querySelector("[data-import-branches]")
    .addEventListener("change", async (event) => {
      try {
        const file = event.target.files[0];
        if (!file) return;
        const data = JSON.parse(await file.text());
        if (
          !data.branches ||
          typeof data.branches !== "object" ||
          Array.isArray(data.branches) ||
          Object.keys(data.branches).length > 50
        )
          throw Error("Choose a branch JSON export.");
        for (const [slug, b] of Object.entries(data.branches))
          if (!/^[a-z0-9-]{1,100}$/.test(slug) || !b || typeof b !== "object")
            throw Error("Invalid branch data.");
        document.getElementById("branch-editor-list").innerHTML =
          Object.entries(data.branches)
            .map(([slug, b]) => renderBranchFields(slug, b))
            .join("");
        initAssetPicker();
        document.getElementById("branches-message").textContent =
          "Imported for review. Save branches to apply.";
      } catch (error) {
        document.getElementById("branches-message").textContent = error.message;
      } finally {
        event.target.value = "";
      }
    });
  form.addEventListener(
    "invalid",
    (event) => {
      const row = event.target.closest("details");
      if (row) row.open = true;
    },
    true,
  );
  form.addEventListener(
    "toggle",
    (event) => {
      if (event.target.matches("details[open]"))
        form.querySelectorAll("details[open]").forEach((row) => {
          if (row !== event.target) row.open = false;
        });
    },
    true,
  );
  form.addEventListener("input", (event) => {
    const row = event.target.closest("[data-branch-slug]");
    if (!row) return;
    if (event.target.name === "name")
      row.querySelector("[data-branch-title]").textContent =
        event.target.value || "New branch";
    if (event.target.name === "color") {
      row.style.setProperty("--branch-color", event.target.value);
      const code = row.querySelector("[data-colour-value]"); if (code) code.textContent = event.target.value;
    }
  });
  document
    .getElementById("check-branch-recovery")
    .addEventListener("click", async () => {
      const panel = document.getElementById("branch-recovery");
      panel.textContent = "Checking saved backups...";
      try {
        const r = await fetch("/api/admin/branches/recovery", {
          cache: "no-store",
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Could not read backups.");
        panel.innerHTML =
          "<p>Checked " +
          data.backupsChecked +
          " backups. " +
          data.changes.length +
          " missing fields can be recovered.</p>" +
          data.changes
            .map(
              (c) =>
                "<article><h3>" +
                escapeHtml(c.branch) +
                " � " +
                escapeHtml(c.field) +
                '</h3><p style="white-space:pre-wrap">' +
                escapeHtml(c.value) +
                "</p><small>Saved in " +
                escapeHtml(c.backup) +
                "</small></article>",
            )
            .join("") +
          (data.changes.length
            ? '<button type="button" class="btn btn--gold" id="recover-branch-details">Recover these missing details</button>'
            : "<p>No earlier saved values were found for the blank fields.</p>");
        panel
          .querySelector("#recover-branch-details")
          ?.addEventListener("click", async () => {
            const button = panel.querySelector("button");
            button.disabled = true;
            try {
              const response = await fetch("/api/branches", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  branches: data.branches,
                  baseRevision: data.baseRevision,
                }),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              branchRevision = response.headers.get("x-config-revision");
              applyBranchConfig(result);
              document.getElementById("branch-editor-list").innerHTML =
                Object.entries(branchConfig.branches)
                  .map(([slug, b]) => renderBranchFields(slug, b))
                  .join("");
              initAssetPicker();
              panel.textContent =
                "Recovered and saved " +
                data.changes.length +
                " missing fields. Existing populated details were preserved.";
            } catch (error) {
              panel.textContent = error.message;
            }
          });
      } catch (error) {
        panel.textContent = error.message;
      }
    });
  form.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-remove-branch]");
    if (
      remove &&
      confirm("Remove this branch? Save branches to publish the change.")
    )
      remove.closest("[data-branch-slug]").remove();
    if (event.target.closest("#add-branch")) {
      form
        .querySelectorAll("details[open]")
        .forEach((row) => (row.open = false));
      document
        .getElementById("branch-editor-list")
        .insertAdjacentHTML(
          "beforeend",
          renderBranchFields("branch-" + crypto.randomUUID(), {}),
        );
      initAssetPicker();
      form.querySelector("[data-branch-slug]:last-child input").focus();
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const branches = {};
    form.querySelectorAll("[data-branch-slug]").forEach((row) => {
      const value = { ...branchConfig.branches[row.dataset.branchSlug] };
      [
        "youtubeUrl",
        "videoUrl",
        "facebookUrl",
        "instagramUrl",
        "autoplay",
        "name",
        "churchName",
        "subtitle",
        "color",
        "logo",
        "image",
        "summary",
        "address",
        "services",
        "contact",
      ].forEach(
        (key) =>
          (value[key] = row.querySelector('[name="' + key + '"]').value.trim()),
      );
      branches[row.dataset.branchSlug] = value;
    });
    const button = form.querySelector('[type="submit"]'),
      message = document.getElementById("branches-message");
    button.disabled = true;
    message.textContent = "Saving branches...";
    try {
      const r = await fetch("/api/branches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branches, baseRevision: branchRevision }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Could not save branches");
      branchRevision = r.headers.get("x-config-revision");
      applyBranchConfig(result);
      message.textContent = "Branches saved. Your website is updated.";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}

let imageFraming = {};
async function loadImageFraming() {
  try {
    const r = await loadConfiguration("image-framing");
    if (r.ok) imageFraming = await r.json();
  } catch {}
}
function frameForImage(image) {
  const path = new URL(image.getAttribute("src") || "", window.location.href)
    .pathname;
  const entry = Object.entries(imageFraming).find(
    ([key]) => new URL(key, window.location.href).pathname === path,
  );
  return entry?.[1];
}
function applyImageFraming(target = document) {
  const images =
    target.tagName === "IMG" ? [target] : target.querySelectorAll("img");
  images.forEach((image) => {
    if (image.dataset.framePreview !== undefined) return;
    const frame = frameForImage(image);
    if (!frame) return;
    image.style.setProperty("object-fit", frame.fit, "important");
    image.style.setProperty(
      "object-position",
      frame.x + "% calc(" + frame.y + "% + " + (frame.offsetY || "0") + "px)",
      "important",
    );
  });
}
function openImageFraming(path) {
  const existing = imageFraming[path] || { fit: "cover", x: "50", y: "0" };
  const dialog = document.createElement("dialog");
  dialog.className = "image-framing-dialog";
  dialog.innerHTML =
    '<form class="admin-form"><h2>Image framing</h2><p>Applies wherever this image is used. Choose “Show full image” to avoid cropping. Preview shapes show how the same image fits different cards.</p><div class="image-framing-previews"><figure><img data-frame-preview src="' +
    escapeAttribute(path) +
    '" alt="Card preview"><figcaption>Wide card</figcaption></figure><figure><img data-frame-preview src="' +
    escapeAttribute(path) +
    '" alt="Portrait preview"><figcaption>Portrait</figcaption></figure></div><label>Image fit<select name="fit"><option value="cover">Fill frame (may crop)</option><option value="contain">Show full image</option></select></label><label>Horizontal alignment<input type="range" name="x" min="0" max="100" value="' +
    escapeAttribute(existing.x) +
    '"><span data-x-label></span></label><label>Vertical alignment<input type="range" name="y" min="0" max="100" value="' +
    escapeAttribute(existing.y) +
    '"><span data-y-label></span></label><label>Move image up/down<input type="range" name="offsetY" min="-150" max="150" step="5" value="' +
    escapeAttribute(existing.offsetY || "0") +
    '"><span data-offset-label></span></label><div class="admin-form__actions"><button type="button" class="btn btn--outline" data-top>Align top</button><button type="button" class="btn btn--outline" data-centre>Centre</button><button type="submit" class="btn btn--gold">Save framing</button><button type="button" class="btn btn--outline" data-close>Cancel</button></div><p role="status" data-frame-message></p></form>';
  document.body.append(dialog);
  const form = dialog.querySelector("form");
  form.elements.fit.value = existing.fit;
  const preview = () => {
    const x = form.elements.x.value,
      y = form.elements.y.value;
    dialog.querySelectorAll("[data-frame-preview]").forEach((img) => {
      img.style.objectFit = form.elements.fit.value;
      img.style.objectPosition =
        x + "% calc(" + y + "% + " + form.elements.offsetY.value + "px)";
    });
    dialog.querySelector("[data-x-label]").textContent =
      x + "% (left to right)";
    dialog.querySelector("[data-y-label]").textContent =
      y + "% (top to bottom)";
    const offset = Number(form.elements.offsetY.value);
    dialog.querySelector("[data-offset-label]").textContent =
      offset === 0
        ? "No shift"
        : Math.abs(offset) + " px " + (offset > 0 ? "down" : "up");
  };
  form.addEventListener("input", preview);
  dialog.querySelector("[data-top]").onclick = () => {
    form.elements.y.value = "0";
    preview();
  };
  dialog.querySelector("[data-centre]").onclick = () => {
    form.elements.x.value = "50";
    form.elements.y.value = "50";
    form.elements.offsetY.value = "0";
    preview();
  };
  dialog.querySelector("[data-close]").onclick = () => dialog.close();
  dialog.addEventListener("close", () => dialog.remove());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]'),
      message = dialog.querySelector("[data-frame-message]");
    button.disabled = true;
    try {
      const frame = {
        fit: form.elements.fit.value,
        x: form.elements.x.value,
        y: form.elements.y.value,
        offsetY: form.elements.offsetY.value,
      };
      const r = await fetch("/api/image-framing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [path]: frame }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Could not save framing");
      imageFraming = result;
      applyImageFraming();
      dialog.close();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  preview();
  dialog.showModal();
}
