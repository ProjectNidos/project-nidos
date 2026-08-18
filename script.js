// === Mobile Nav Toggle — hamburger for narrow screens (CSS shows it ≤700px) ===
(function() {
    function initNavToggle() {
        var nav = document.querySelector('.nav');
        var inner = nav && nav.querySelector('.nav-inner');
        var links = nav && nav.querySelector('.nav-links');
        if (!nav || !inner || !links || nav.querySelector('.nav-toggle')) return;

        var btn = document.createElement('button');
        btn.className = 'nav-toggle';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Izvēlne / Menu');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span></span><span></span><span></span>';
        inner.appendChild(btn);

        btn.addEventListener('click', function() {
            var open = nav.classList.toggle('nav-open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        // Close the menu after tapping a link
        links.addEventListener('click', function(e) {
            if (e.target.closest('a')) {
                nav.classList.remove('nav-open');
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNavToggle);
    } else {
        initNavToggle();
    }
})();

// === Language Switcher — immediate, no intro dependency ===
(function() {
    function isEnglishPage() {
        return window.location.pathname.includes('-en');
    }

    function getTargetPath(lang) {
        var path = window.location.pathname;
        if (lang === 'en') {
            if (path === '/' || path === '/index.html' || path === '/index-lv.html') return '/index-en.html';
            return path.replace(/\.html$/, '-en.html');
        } else {
            if (path === '/index-en.html') return '/';
            if (path.endsWith('-en.html')) return path.replace('-en.html', '.html');
            return path;
        }
    }

    function buildSwitcher() {
        var container = document.querySelector('.lang-switcher-container');
        if (!container) {
            var navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                container = document.createElement('div');
                container.className = 'lang-switcher-container';
                container.style.cssText = 'margin-left:1rem;display:flex;gap:0.5rem;';
                navLinks.appendChild(container);
            }
        }
        if (!container) return;

        var isEN = isEnglishPage();

        var lvBtn = document.createElement('button');
        lvBtn.className = 'lang-pill' + (isEN ? '' : ' active');
        lvBtn.textContent = 'LV';
        lvBtn.setAttribute('aria-label', 'Latviešu');
        lvBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = getTargetPath('lv');
        });

        var enBtn = document.createElement('button');
        enBtn.className = 'lang-pill' + (isEN ? ' active' : '');
        enBtn.textContent = 'EN';
        enBtn.setAttribute('aria-label', 'English');
        enBtn.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = getTargetPath('en');
        });

        container.innerHTML = '';
        container.appendChild(lvBtn);
        container.appendChild(enBtn);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildSwitcher);
    } else {
        buildSwitcher();
    }
})();
// Cookie Consent Banner — GDPR-compliant bilingual (LV/EN)
(function() {
    const consent = localStorage.getItem('cookie_consent');
    if (consent === 'accepted' || consent === 'declined') return;

    const isEN = window.location.pathname.includes('-en');
    const t = {
        text: isEN
            ? 'This site uses only essential cookies — no tracking, no ads. Choosing "Decline" means no cookies will be stored.'
            : 'Šī vietne izmanto tikai nepieciešamās sīkdatnes — bez izsekošanas, bez reklāmām. Izvēloties "Noraidīt", netiks saglabātas nekādas sīkdatnes.',
        policy: isEN ? 'Cookie Policy' : 'Sīkdatņu politika',
        decline: isEN ? 'Decline' : 'Noraidīt',
        accept: isEN ? 'Accept' : 'Apstiprināt'
    };

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = '<div class="cookie-banner-inner">' +
        '<p>' + t.text + ' ' +
        '<a href="/nidos/cookie-policy.html">' + t.policy + '</a></p>' +
        '<div class="cookie-buttons">' +
            '<button id="cookie-decline" class="btn-secondary" style="white-space:nowrap;">' + t.decline + '</button>' +
            '<button id="cookie-accept" class="btn-primary" style="white-space:nowrap;">' + t.accept + '</button>' +
        '</div>' +
    '</div>';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:var(--bg-secondary);border-top:1px solid var(--border-color);padding:1rem 0;backdrop-filter:blur(12px);';

    document.body.appendChild(banner);

    /* The banner is fixed to the bottom, so it covers whatever is on screen —
       and the contact section is budgeted to the pixel, which lands its submit
       underneath on a short window. Publish the height so layout can reserve
       it, and hand the space back the moment the banner goes. */
    function publishHeight() {
        document.documentElement.style.setProperty(
            '--consent-h', Math.ceil(banner.getBoundingClientRect().height) + 'px');
    }
    publishHeight();
    window.addEventListener('resize', publishHeight);   // it reflows and rewraps

    function hideBanner() {
        window.removeEventListener('resize', publishHeight);
        document.documentElement.style.setProperty('--consent-h', '0px');
        banner.style.transition = 'opacity 0.3s, transform 0.3s';
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(20px)';
        setTimeout(function() { banner.remove(); }, 300);
    }

    document.getElementById('cookie-accept').addEventListener('click', function() {
        localStorage.setItem('cookie_consent', 'accepted');
        hideBanner();
    });

    document.getElementById('cookie-decline').addEventListener('click', function() {
        localStorage.setItem('cookie_consent', 'declined');
        hideBanner();
    });
})();



/* Lenis is created once, in the page head, from /vendor/lenis.min.js - see the
   guarded block in the HTML. It used to be injected a second time here from
   unpkg, ungated: that second instance ran on phones (which 6ac8c5f had just
   taken Lenis off), never stopped for the splash, and gave the page two
   autoRaf loops both writing window scroll. A pinned section derives its
   progress from scroll position, so two writers is not a style question. */

// Intersection Observer for Animations
class AnimateOnScroll {
    constructor() {
        this.init();
    }

    init() {
        const observer = new IntersectionObserver((entries) => {
            let delay = 0;
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.transitionDelay = `${delay}s`;
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                    delay += 0.08;
                }
            });
        }, {
            threshold: 0,
            rootMargin: '0px 0px 100px 0px'
        });

        document.querySelectorAll('.bento-card, .contact-info, .contact-form, .section-header, .hero-content > *').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            el.style.transition = 'opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
            observer.observe(el);
        });

        const style = document.createElement('style');
        style.textContent = `
            .animate-in {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Intro Sequence (runs immediately — DOM already ready at end of body)
(() => {
    const introScreen = document.querySelector('.intro-screen');
    const introLogo = document.querySelector('.intro-logo');

    // Video intro pages drive the splash from their own inline script
    if (document.querySelector('.intro-video')) return;

    if (introScreen && introLogo) {
        // Step 1: Fade in logo quickly
        setTimeout(() => {
            introLogo.classList.add('show');
        }, 100);
        
        // Step 2: Hide intro screen and slide main up
        setTimeout(() => {
            introScreen.classList.add('intro-done');
            const nav = document.querySelector('.nav');
            if (nav) nav.classList.add('visible');
            const mainContent = document.querySelector('main');
            if(mainContent) mainContent.classList.remove('intro-active');
            
            // Wait for slide up to finish before showing main content
            setTimeout(() => {
                new AnimateOnScroll();
            }, 800); 
        }, 2200);
    } else {
        // No splash on this page — the nav has nothing to wait for
        const nav = document.querySelector('.nav');
        if (nav) nav.classList.add('visible');
        new AnimateOnScroll();
    }
})()

// Nav picks up its backdrop + hairline once the page is scrolled (all pages)
;(() => {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
})()
    
    // --- Floating Service Chatbot for all four services ---
    const serviceCards = document.querySelectorAll('.service-card[data-service]');
    const serviceChat = document.getElementById('service-chat');
    const chatMessages = document.querySelector('.floating-chat-messages');
    const chatForm = document.querySelector('.floating-chat-form');
    const chatInput = document.querySelector('.floating-chat-input');
    const chatClose = document.querySelector('.floating-chat-close');
    const chatSendBtn = document.querySelector('.floating-chat-send');
    const chatTitleEl = document.getElementById('chat-title');
    const chatSubtitleEl = document.getElementById('chat-subtitle');

    const serviceFlows = {
        en: {
            strategy: {
                title: "Digital Strategy Chat",
                subtitle: "Answer a few questions & we’ll prepare strategy next steps.",
                intro: "Hi, I’m your Project Nidos digital strategy assistant.",
                questions: [
                    "First, what does your company do and in which markets do you operate?",
                    "What is the main outcome you want from digital strategy in the next 12 months? (e.g. more leads, efficiency, new markets)",
                    "Roughly how many employees are in your company?",
                    "When would you ideally like to start working on this? (now, 3–6 months, later)"
                ]
            },
            crm: {
                title: "CRM & ERP Chat",
                subtitle: "Let’s see how we can streamline your operations.",
                intro: "Hi, I’m your CRM & ERP assistant.",
                questions: [
                    "What tools or systems are you currently using to manage clients, sales and operations?",
                    "What is the biggest pain point today? (e.g. duplicate data, manual work, poor reporting)",
                    "How many people would actively use a CRM/ERP system in your company?",
                    "Have you already shortlisted any specific platforms or are you open to recommendations?"
                ]
            },
            web: {
                title: "Online Presence Chat",
                subtitle: "Let’s clarify what your website should deliver.",
                intro: "Hi, I’m your online presence assistant.",
                questions: [
                    "Do you already have a website or online store? If yes, please share the URL.",
                    "What is the primary goal of your online presence? (e.g. trust, leads, direct sales)",
                    "Who is your main target audience online?",
                    "Are there any websites you like that reflect what you’re aiming for?"
                ]
            },
            grants: {
                title: "EU Grants Chat",
                subtitle: "We’ll quickly see if there could be a fit with EU funding.",
                intro: "Hi, I’m your EU grants assistant.",
                questions: [
                    "In a sentence or two, what kind of project are you thinking about financing with EU funds?",
                    "Where is your company registered and how many employees do you have?",
                    "Have you applied for EU grants before?",
                    "When would you like to start the project if funding is approved?"
                ]
            }
        },
        lv: {
            strategy: {
                title: "Digitālās stratēģijas čats",
                subtitle: "Atbildiet uz dažiem jautājumiem un mēs sagatavosim nākamos soļus.",
                intro: "Sveiki, es esmu jūsu Projekts Ligzda digitālās stratēģijas asistents.",
                questions: [
                    "Vispirms – ar ko nodarbojas jūsu uzņēmums un kuros tirgos strādājat?",
                    "Kādu galveno rezultātu vēlaties sasniegt ar digitālo stratēģiju nākamo 12 mēnešu laikā? (piemēram, vairāk klientu, efektivitāte, jauni tirgi)",
                    "Aptuveni cik darbinieku ir jūsu uzņēmumā?",
                    "Kad ideāli vēlētos sākt darbu pie šīs tēmas? (tagad, 3–6 mēneši, vēlāk)"
                ]
            },
            crm: {
                title: "CRM un ERP čats",
                subtitle: "Noskaidrosim, kā sakārtot jūsu procesus.",
                intro: "Sveiki, es esmu jūsu CRM un ERP asistents.",
                questions: [
                    "Kādus rīkus vai sistēmas pašlaik izmantojat klientu, pārdošanas un operāciju vadībai?",
                    "Kur šobrīd ir lielākās problēmas? (piemēram, dubulti dati, manuāls darbs, slikts pārskats)",
                    "Cik cilvēki jūsu uzņēmumā aktīvi izmantotu CRM/ERP sistēmu?",
                    "Vai jau esat apsvēruši kādas konkrētas platformas, vai arī esat atvērti ieteikumiem?"
                ]
            },
            web: {
                title: "Tiešsaistes klātbūtnes čats",
                subtitle: "Noskaidrosim, ko jūsu mājaslapai jānodrošina.",
                intro: "Sveiki, es esmu jūsu tiešsaistes klātbūtnes asistents.",
                questions: [
                    "Vai jums jau ir mājaslapa vai interneta veikals? Ja jā, lūdzu, norādiet adresi.",
                    "Kāds ir galvenais mērķis jūsu tiešsaistes klātbūtnei? (piemēram, uzticamība, pieteikumi, tiešie pārdošanas darījumi)",
                    "Kāda ir jūsu galvenā mērķauditorija tiešsaistē?",
                    "Vai ir kādas mājaslapas, kas jums patīk un uz kurām varam orientēties?"
                ]
            },
            grants: {
                title: "ES grantu čats",
                subtitle: "Ātri pārbaudīsim, vai jūsu idejai varētu derēt ES finansējums.",
                intro: "Sveiki, es esmu jūsu ES grantu asistents.",
                questions: [
                    "Dažos teikumos – kādu projektu vēlaties finansēt ar ES līdzekļiem?",
                    "Kur ir reģistrēts jūsu uzņēmums un cik darbinieku tajā strādā?",
                    "Vai iepriekš esat pieteikušies ES grantiem?",
                    "Kad vēlētos sākt projektu, ja finansējums tiktu apstiprināts?"
                ]
            }
        }
    };

    const contactQuestions = {
        en: [
            "To follow up, please share your full name.",
            "And finally, your work email so we can reach you with a tailored proposal."
        ],
        lv: [
            "Lai varam sazināties, lūdzu, norādiet savu vārdu un uzvārdu.",
            "Un visbeidzot – jūsu darba e‑pasts, uz kuru varam nosūtīt piedāvājumu."
        ]
    };

    const messagesByLang = {
        en: {
            invalidEmail: "Please enter a valid work email so we can get back to you.",
            thankYou: "Thank you. We’ll review your answers and come back with concrete next steps."
        },
        lv: {
            invalidEmail: "Lūdzu, ievadiet derīgu darba e‑pastu, lai mēs varētu ar jums sazināties.",
            thankYou: "Paldies! Pārskatīsim jūsu atbildes un nosūtīsim konkrētus nākamos soļus."
        }
    };

    const inputUiByLang = {
        en: {
            placeholder: "Type your answer…",
            sendLabel: "Send"
        },
        lv: {
            placeholder: "Ierakstiet savu atbildi…",
            sendLabel: "Sūtīt"
        }
    };

    let currentServiceKey = null;
    let currentQuestions = [];
    let currentStep = 0;
    const answers = [];

    function addChatMessage(text, author = 'bot') {
        if (!chatMessages) return;
        const bubble = document.createElement('div');
        bubble.className = `chat-message ${author}`;
        bubble.innerHTML = `<p>${text}</p>`;
        chatMessages.appendChild(bubble);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function startServiceChat(serviceKey) {
        const flowsForLang = serviceFlows[currentLang] || serviceFlows.en;
        const flow = flowsForLang[serviceKey];
        if (!serviceChat || !flow) return;

        serviceChat.hidden = false;
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.value = '';
            chatInput.focus();
            const ui = inputUiByLang[currentLang] || inputUiByLang.en;
            chatInput.placeholder = ui.placeholder;
        }
        if (chatSendBtn) {
            const ui = inputUiByLang[currentLang] || inputUiByLang.en;
            chatSendBtn.textContent = ui.sendLabel;
        }
        if (chatMessages) chatMessages.innerHTML = '';
        answers.length = 0;
        currentServiceKey = serviceKey;
        const contactQsForLang = contactQuestions[currentLang] || contactQuestions.en;
        currentQuestions = [...flow.questions, ...contactQsForLang];
        currentStep = 0;

        if (chatTitleEl) chatTitleEl.textContent = flow.title;
        if (chatSubtitleEl) chatSubtitleEl.textContent = flow.subtitle;

        addChatMessage(flow.intro);
        addChatMessage(currentQuestions[currentStep]);
    }

    if (serviceCards.length && serviceChat) {
        serviceCards.forEach(card => {
            card.addEventListener('click', () => {
                const key = card.getAttribute('data-service');
                startServiceChat(key);
            });
        });
    }

    if (chatClose && serviceChat) {
        chatClose.addEventListener('click', () => {
            serviceChat.hidden = true;
        });
    }

    async function submitServiceLeadToCRM(payload) {
        try {
            const res = await fetch('/api/webhooks/form-lead', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                console.error('Failed to submit service lead', await res.text());
            }
        } catch (err) {
            console.error('Error submitting service lead', err);
        }
    }

    if (chatForm && chatInput) {
        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const value = chatInput.value.trim();
            if (!value || !currentQuestions.length) return;

            addChatMessage(value, 'user');
            answers.push({ question: currentQuestions[currentStep], answer: value });
            chatInput.value = '';
            chatInput.focus(); // Keep keyboard open

            currentStep += 1;

            if (currentStep < currentQuestions.length) {
                setTimeout(() => {
                    addChatMessage(currentQuestions[currentStep]);
                }, 500); // Small delay for natural feel
            } else {
                const nameAnswer = answers[answers.length - 2]?.answer || '';
                const emailAnswer = answers[answers.length - 1]?.answer || '';

                // Stricter Email Validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailAnswer)) {
                    const invalidMsg = messagesByLang[currentLang]?.invalidEmail || messagesByLang.en.invalidEmail;
                    addChatMessage(invalidMsg, 'bot');
                    currentStep = currentQuestions.length - 1; // Repeat email question
                    return;
                }

                const thankYouMsg = messagesByLang[currentLang]?.thankYou || messagesByLang.en.thankYou;
                addChatMessage(thankYouMsg, 'bot');

                // Generate "Conclusion" / Structured Profile
                const flow = (serviceFlows[currentLang] || serviceFlows.en)[currentServiceKey];
                const labels = [
                    "🏢 Industry/Market",
                    "🎯 Primary Goal",
                    "👥 Company Size",
                    "⏳ Timeline",
                    "👤 Contact Name",
                    "📧 Email"
                ];

                let formattedMessage = `=== LEAD SNAPSHOT ===\n\n`;
                formattedMessage += `SOURCE: ${flow.title}\n`;
                formattedMessage += `-------------------\n`;

                answers.forEach((a, i) => {
                    // Use custom label if available, otherwise fallback to "Q"
                    const label = i < labels.length ? labels[i] : `Question ${i + 1}`;
                    formattedMessage += `**${label}**:\n${a.answer}\n\n`;
                });

                await submitServiceLeadToCRM({
                    name: nameAnswer,
                    email: emailAnswer,
                    phone: '',
                    message: formattedMessage, // Send structured conclusion
                    source: currentServiceKey || 'service_chat'
                });

                chatInput.disabled = true;
            }
        });
    }

    // --- Contact form -> CRM lead ---
    const contactForm = document.querySelector('.contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = contactForm.querySelector('#name');
            const emailInput = contactForm.querySelector('#email');
            const messageInput = contactForm.querySelector('#message');
            const interestInput = contactForm.querySelector('#interest');

            const name = nameInput?.value.trim() || '';
            const email = emailInput?.value.trim() || '';
            /* Two things travel from the select, and they are not redundant.
               The VALUE keys the CRM's request category server-side; the
               visible LABEL rides along at the head of the message because the
               category is the coarser of the two - two options collapse into
               digitalisation and two more into general - so without it the
               exact answer would be lost. Label, not value, because the label
               is the wording the person actually chose, in their language. */
            const interest = interestInput?.value || '';
            const interestLabel = interestInput?.selectedOptions[0]?.text.trim() || '';
            const body = messageInput?.value.trim() || '';
            const message = interestLabel ? `[${interestLabel}] ${body}` : body;

            if (!email) {
                alert('Please enter your email.');
                return;
            }

            try {
                const res = await fetch('/api/webhooks/form-lead', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    /* No `source` here. The endpoint derives it from `interest`
                       and never read a client-supplied one - sending it just
                       made it look like the category was being set. */
                    body: JSON.stringify({
                        name,
                        email,
                        phone: '',
                        message,
                        interest
                    })
                });

                if (!res.ok) {
                    console.error('Failed to submit contact form lead', await res.text());
                    alert('There was a problem submitting your message. Please try again later.');
                    return;
                }

                alert('Thank you! We will get back to you soon.');
                contactForm.reset();
            } catch (err) {
                console.error('Error submitting contact form lead', err);
                alert('There was a problem submitting your message. Please try again later.');
            }
        });
    }

    // --- Smooth Scroll handled by Lenis ---

// === Hero node network — literal density (canvas .hero-net, landing pages only) ===
(function () {
    var canvas = document.querySelector('.hero-net');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    /* A touch device gets the field, not the drift. Repainting a fixed
       full-viewport canvas every frame while the compositor is also trying to
       scroll is what a phone can least afford, and at this size the motion is
       far too slow to notice missing. */
    var still = reduceMotion || window.matchMedia('(hover: none)').matches;

    var DENSITY = 3800;      // px^2 per node
    var LINK_DIST = 190;
    var NODE_ALPHA = 0.7;
    var LINE_ALPHA = 0.26;
    var SPEED = 0.3;
    var NODE_R = 2.1;
    var MAX_NODES = 220;

    var W = 0, H = 0, nodes = [];
    var mouse = { x: -9999, y: -9999 };

    /* ===== BAND EXCITATION =====
       The advisory rows publish the strip of viewport they occupy, and the
       field lights up inside it: nodes swell and run hotter, links reach
       further and burn brighter. Everything outside the strip is left exactly
       as it was, so it reads as one row exciting the network rather than the
       whole background reacting to a pointer. */
    var band = null;         // { x0, y0, y1 } in client px - the canvas is fixed, so client coords ARE canvas coords
    var bandAmp = 0;         // eased 0..1: entering and leaving a row is a swell, never a switch
    var bandWant = 0;
    var boost = [];          // per-node excitation, rebuilt once per frame rather than per link pair
    var BAND_FEATHER = 40;   // px of falloff above and below the row, so the strip has no cut edge
    var BAND_REACH = 150;    // px of falloff left of the plate, so the heat dies before it reaches the copy

    window.addEventListener('pn:band', function (e) {
        band = e.detail || null;
        bandWant = band ? 1 : 0;
    });

    function measureBoost() {
        var i, n, fy, fx, d;
        for (i = 0; i < nodes.length; i++) {
            n = nodes[i];
            if (n.y < band.y0) { d = band.y0 - n.y; fy = d < BAND_FEATHER ? 1 - d / BAND_FEATHER : 0; }
            else if (n.y > band.y1) { d = n.y - band.y1; fy = d < BAND_FEATHER ? 1 - d / BAND_FEATHER : 0; }
            else { fy = 1; }
            if (fy <= 0) { boost[i] = 0; continue; }
            d = band.x0 - n.x;
            fx = d <= 0 ? 1 : (d < BAND_REACH ? 1 - d / BAND_REACH : 0);
            boost[i] = fy * fx * bandAmp;
        }
    }

    /* ===== POINTER EFFECT — "Ember Trail" =====
       Pointer movement sheds tiny warm sparks that drift, rise and cool over
       about a second. A resting pointer sheds nothing, and nothing is drawn AT
       the pointer itself — which is what keeps it from reading as a crosshair. */
    var frame = 0;
    var prng = 987654321;
    var FX_S = {
        nodes: nodes, mouse: mouse, W: 0, H: 0, t: 0,
        LINK_DIST: LINK_DIST,
        rand: function () { prng = (prng * 1664525 + 1013904223) >>> 0; return prng / 4294967296; },
        store: {}
    };

    var FX =
    {
      key: 'embers',
      name: 'Ember Trail',
      blurb: 'Moving your pointer sheds a few tiny warm sparks that drift, rise, and fade in about a second - a brief heat signature of where you have been, and nothing when you rest.',

      init: function (S) {
        S.store.pool = [];      // live embers, hard-capped; swap-pop removal keeps this allocation-quiet
        S.store.carry = 0;      // fractional spawn accumulator: lets shed rate go below 1 ember/frame
        S.store.px = 0;
        S.store.py = 0;
        S.store.hasPrev = false; // false until one on-canvas frame is seen; prevents an entry spray
      },

      frame: function (ctx, S) {
        var st = S.store;
        var pool = st.pool;
        var TAU = Math.PI * 2;

        // ---- tuning ----
        var MAX = 90;         // pool cap: covers a full-screen sweep, and 90 tiny arcs is negligible per frame
        var DEAD_ZONE = 1.6;  // px/frame below which nothing sheds: a resting hand micro-jitters ~1px, and "still sheds nothing" is the contract
        var PER_PX = 0.10;    // embers per px travelled: ~3/frame at a brisk 30px/frame sweep - a whisper, not fireworks
        var BURST_CAP = 4;    // per-frame spawn ceiling so one violent flick cannot dump the pool in a single clump
        var TELEPORT = 200;   // px/frame above this is a re-entry or tab-switch jump, not a gesture - record, do not shed
        var INHERIT = 0.16;   // fraction of pointer velocity an ember keeps: enough to read as "shed by movement", not "launched"
        var SPREAD = 0.5;     // random velocity noise (px/frame): keeps a straight drag from leaving a machine-perfect line
        var DRAG = 0.94;      // per-frame damping: lateral motion dies within ~15 frames, after which buoyancy owns the ember
        var LIFT = 0.016;     // upward bias per frame: heat rises, but slowly - reads as ember, not bubble
        var PEAK_A = 0.55;    // birth alpha on a sub-node-size dot: visible on a 27" display, never competes with copy

        var mx = S.mouse.x, my = S.mouse.y;
        var onCanvas = mx > -9000; // mouse.x is -9999 off-canvas

        // ---- shed ----
        if (onCanvas && st.hasPrev) {
          var dx = mx - st.px, dy = my - st.py;
          var speed = Math.sqrt(dx * dx + dy * dy);
          if (speed > TELEPORT) {
            // pointer jumped (re-entered canvas, window refocus): treat as a fresh start, no spray
            st.carry = 0;
          } else if (speed > DEAD_ZONE) {
            st.carry += speed * PER_PX;
            var want = Math.floor(st.carry);
            if (want > BURST_CAP) want = BURST_CAP;
            st.carry -= want;
            if (st.carry > 2) st.carry = 2; // never bank more than a moment's worth of embers during cap-outs
            for (var s = 0; s < want && pool.length < MAX; s++) {
              // spawn along this frame's travel segment: fast sweeps leave a continuous wake, not per-frame clumps
              var u = S.rand();
              pool.push({
                x: st.px + dx * u + (S.rand() - 0.5) * 3, // +-1.5px jitter: embers scatter off the path, not on a rail
                y: st.py + dy * u + (S.rand() - 0.5) * 3,
                vx: dx * INHERIT + (S.rand() - 0.5) * SPREAD,
                vy: dy * INHERIT + (S.rand() - 0.5) * SPREAD,
                life: 0,
                max: 36 + Math.floor(S.rand() * 37),      // 36-72 frames = 0.6-1.2s at 60fps: long enough to register, short enough to stay "brief"
                r: 1 + S.rand() * 0.5,                    // 1-1.5px: deliberately smaller than the 2.1px network nodes, so embers stay subordinate
                g: 110 + Math.floor(S.rand() * 50),       // per-ember green channel 110-160: warm hue jitter, all inside the site's orange family
                ph: S.rand() * TAU                        // flicker phase offset so the pool never pulses in unison
              });
            }
          } else {
            st.carry = 0; // a still pointer sheds nothing - and banks nothing for later
          }
        }
        if (onCanvas) { st.px = mx; st.py = my; st.hasPrev = true; }
        else { st.hasPrev = false; } // off-canvas: stop shedding; live embers below simply finish dying, so the effect fades gracefully

        // ---- update + draw, single O(pool) pass with swap-pop removal ----
        var i = 0, e, t, a, flick;
        while (i < pool.length) {
          e = pool[i];
          e.life++;
          if (e.life >= e.max) {
            pool[i] = pool[pool.length - 1];
            pool.pop();
            continue; // re-check the swapped-in ember at this index
          }
          e.vx *= DRAG;
          e.vy = e.vy * DRAG - LIFT;
          e.x += e.vx;
          e.y += e.vy;

          t = 1 - e.life / e.max; // 1 at birth -> 0 at death
          // +-15% shimmer at ~3Hz: enough to feel alive on 1.5px dots, far too small and slow to strobe
          flick = 0.85 + 0.15 * Math.sin(S.t * 0.3 + e.ph);
          // t^2 decay: brightness collapses early, so the trail reads as cooling heat rather than lingering paint
          a = PEAK_A * t * t * flick;

          ctx.fillStyle = 'rgba(255,' + e.g + ',60,' + a.toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r * (0.6 + 0.4 * t), 0, TAU); // shrinks to 60% as it cools
          ctx.fill();

          // white-hot core only in the first quarter of life, capped at 0.18 alpha - under the 0.2 white ceiling
          if (t > 0.75) {
            ctx.fillStyle = 'rgba(255,255,255,' + (0.18 * (t - 0.75) * 4).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(e.x, e.y, e.r * 0.5, 0, TAU);
            ctx.fill();
          }
          i++;
        }
      },

      onClick: function (S) {
        // a click taps the surface: a soft puff of six slow embers - no ring, no flash, no HUD
        var st = S.store;
        if (!st.pool || S.mouse.x < -9000) return;
        var TAU = Math.PI * 2;
        for (var k = 0; k < 6 && st.pool.length < 90; k++) {
          var ang = S.rand() * TAU;
          var sp = 0.3 + S.rand() * 0.6; // slower than movement-shed embers: a settle, not a burst
          st.pool.push({
            x: S.mouse.x + (S.rand() - 0.5) * 4,
            y: S.mouse.y + (S.rand() - 0.5) * 4,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            life: 0,
            max: 48 + Math.floor(S.rand() * 25), // 0.8-1.2s: click embers linger at the top of the normal range
            r: 1 + S.rand() * 0.5,
            g: 110 + Math.floor(S.rand() * 50),
            ph: S.rand() * TAU
          });
        }
      }
    };


    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seed();
        if (still) draw();   // one frame, then nothing
    }

    function seed() {
        var count = Math.min(Math.round((W * H) / DENSITY), MAX_NODES);
        nodes = [];
        boost.length = count;
        for (var i = 0; i < count; i++) {
            nodes.push({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * SPEED,
                vy: (Math.random() - 0.5) * SPEED
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);
        // No band lit: the resting field draws down exactly the path it always did
        var hot = band !== null && bandAmp > 0.01;
        if (hot) measureBoost();
        var i, j, a, b, dx, dy, d2, t, ba, bm, reach;
        for (i = 0; i < nodes.length; i++) {
            a = nodes[i];
            ba = hot ? boost[i] : 0;
            for (j = i + 1; j < nodes.length; j++) {
                b = nodes[j];
                // Averaged, not maxed: a link with one end outside the strip is only
                // half-lit, which keeps the bloom on the row instead of letting it
                // radiate a link-length in every direction
                bm = hot ? (ba + boost[j]) * 0.5 : 0;
                // An excited node reaches further, so the strip visibly knits itself together
                reach = bm ? LINK_DIST * (1 + 0.3 * bm) : LINK_DIST;
                dx = a.x - b.x; dy = a.y - b.y;
                d2 = dx * dx + dy * dy;
                if (d2 < reach * reach) {
                    t = 1 - Math.sqrt(d2) / reach;
                    if (bm) {
                        ctx.strokeStyle = 'rgba(255, ' + Math.round(138 + 42 * bm) + ', ' + Math.round(68 + 62 * bm) + ', ' + Math.min(0.95, LINE_ALPHA * t * (1 + 4.2 * bm)).toFixed(3) + ')';
                        ctx.lineWidth = 1 + 0.5 * bm;
                    } else {
                        ctx.strokeStyle = 'rgba(255, 138, 68, ' + (LINE_ALPHA * t).toFixed(3) + ')';
                        ctx.lineWidth = 1;
                    }
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }
        ctx.fillStyle = 'rgba(255, 133, 84, ' + NODE_ALPHA + ')';
        for (i = 0; i < nodes.length; i++) {
            a = nodes[i];
            ba = hot ? boost[i] : 0;
            // Only a lit node pays for its own fillStyle; the resting field keeps one assignment for all of them
            if (ba > 0.01) {
                ctx.fillStyle = 'rgba(255, ' + Math.round(133 + 52 * ba) + ', ' + Math.round(84 + 92 * ba) + ', ' + Math.min(1, NODE_ALPHA * (1 + 0.45 * ba)).toFixed(3) + ')';
            }
            ctx.beginPath();
            ctx.arc(a.x, a.y, NODE_R * (1 + 0.6 * ba), 0, Math.PI * 2);
            ctx.fill();
            if (ba > 0.01) ctx.fillStyle = 'rgba(255, 133, 84, ' + NODE_ALPHA + ')';
        }
    }

    function tick() {
        var i, n, dx, dy, d2, d, f;
        for (i = 0; i < nodes.length; i++) {
            n = nodes[i];
            n.x += n.vx;
            n.y += n.vy;
            dx = n.x - mouse.x; dy = n.y - mouse.y;
            d2 = dx * dx + dy * dy;
            if (d2 < 22500) {
                d = Math.sqrt(d2) || 1;
                f = (150 - d) / 150 * 0.35;
                n.x += (dx / d) * f;
                n.y += (dy / d) * f;
            }
            if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
            if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
        }
        bandAmp += (bandWant - bandAmp) * 0.14;   // ~0.3s to full heat, and the same back out
        draw();

        FX_S.nodes = nodes; FX_S.W = W; FX_S.H = H; FX_S.t = ++frame;
        try {
            FX.frame(ctx, FX_S);
        } catch (err) {
            // A decorative layer must never take the background down with it
            FX.frame = function () {};
            if (window.console) console.warn('pointer effect disabled', err);
        }

        requestAnimationFrame(tick);
    }

    canvas.parentElement.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
    });
    canvas.parentElement.addEventListener('pointerleave', function () {
        mouse.x = -9999; mouse.y = -9999;
    });
    canvas.parentElement.addEventListener('pointerdown', function () {
        if (!reduceMotion && FX.onClick) FX.onClick(FX_S);
    });
    window.addEventListener('resize', resize);

    resize();
    FX_S.W = W; FX_S.H = H;
    FX.init(FX_S);
    /* The splash owns the machine while it plays: on a phone this canvas would be
       animating a field nobody can see - it is held at opacity 0 - against video
       decode on the same core. Wait for the intro to release the page. */
    if (!still) {
        if (document.documentElement.classList.contains('intro-lock')) {
            var unlock = new MutationObserver(function () {
                if (document.documentElement.classList.contains('intro-lock')) return;
                unlock.disconnect();
                requestAnimationFrame(tick);
            });
            unlock.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        } else {
            requestAnimationFrame(tick);
        }
    }
})();

/* ===== SERVICES FRAMEWORK =====
   Left rail scrolls, right stage stays pinned. The item crossing the
   focus line becomes active and the stage caption swaps to match. */
/* Stage media — one picture per service, follows fw:change */
;(() => {
    const stage = document.querySelector('.fw-stage');
    if (!stage) return;
    const imgs = [...stage.querySelectorAll('.fw-stage-media img')];
    if (!imgs.length) return;
    stage.addEventListener('fw:change', (e) => {
        imgs.forEach((img, i) => img.classList.toggle('is-active', i === e.detail.index));
    });
})()

;(() => {
    const stage = document.querySelector('.fw-stage');
    const items = [...document.querySelectorAll('.fw-item')];
    if (!stage || !items.length) return;

    const titleEl = stage.querySelector('.fw-stage-title');

    let current = -1;
    let swapTimer = 0;

    const setActive = (idx) => {
        if (idx === current) return;
        current = idx;
        items.forEach((el, i) => el.classList.toggle('is-active', i === idx));

        const item = items[idx];
        stage.classList.add('is-swapping');
        clearTimeout(swapTimer);
        swapTimer = setTimeout(() => {
            titleEl.textContent = item.dataset.title;
            stage.classList.remove('is-swapping');
        }, 300);
        stage.dispatchEvent(new CustomEvent('fw:change', { detail: { index: idx } }));
    };

    // Focus line sits above centre so an item lights up as it settles into view
    const pick = () => {
        const line = window.innerHeight * 0.42;
        let best = 0;
        let bestDist = Infinity;
        items.forEach((el, i) => {
            const r = el.getBoundingClientRect();
            const dist = r.top <= line && r.bottom >= line ? 0 : Math.min(Math.abs(r.top - line), Math.abs(r.bottom - line));
            if (dist < bestDist) { bestDist = dist; best = i; }
        });
        setActive(best);
    };

    let queued = false;
    const onScroll = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; pick(); });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // First paint gets the active state without the crossfade
    items[0].classList.add('is-active');
    current = 0;
    pick();
})()

/* ===== FRAMEWORK STAGE — particle tunnel (canvas .fw-stage-net) ===== */
;(function () {
    var canvas = document.querySelector('.fw-stage-net');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var stage = canvas.closest('.fw-stage');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var COUNT = 1600;
    var FOCAL = 560;        // perspective strength
    var DEPTH = 1000;       // z range
    var SPREAD = 520;       // half-width of the field; wider than this and far dots miss the panel
    var SPEED = 2.2;
    var RINGS = 16;         // corridor outlines receding to the vanishing point
    var RING_HALF = 460;    // half-width of a corridor ring in world units

    var W = 0, H = 0, dpr = 1, pts = [];
    var speed = SPEED, targetSpeed = SPEED;
    var running = false, frame = 0;

    function spawn(p, far) {
        // Square field, projected — keeps the vanishing point dense and the edges sparse
        p.x = (Math.random() - 0.5) * 2 * SPREAD;
        p.y = (Math.random() - 0.5) * 2 * SPREAD;
        p.z = far ? DEPTH : Math.random() * DEPTH;
        p.warm = Math.random() < 0.12;   // a few embers pick up the brand orange
        return p;
    }

    var rings = [];

    function build() {
        var i;
        pts = [];
        for (i = 0; i < COUNT; i++) pts.push(spawn({}, false));
        rings = [];
        for (i = 0; i < RINGS; i++) rings.push({ z: (i + 1) / RINGS * DEPTH });
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        if (!W || !H) return;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw() {
        if (!W || !H) return;
        var cx = W / 2, cy = H / 2, i, p, k, sx, sy, r, a;

        ctx.fillStyle = '#060606';
        ctx.fillRect(0, 0, W, H);

        // Horizon bloom at the vanishing point
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.45);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
        g.addColorStop(0.35, 'rgba(255, 95, 31, 0.05)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // Corridor: nested squares receding to the vanishing point. Cheap, but
        // it is what turns a starfield into a space you are travelling through.
        ctx.lineWidth = 1;
        for (i = 0; i < rings.length; i++) {
            var rz = rings[i].z;
            k = FOCAL / rz;
            var hw = RING_HALF * k;
            if (hw < 2) continue;
            a = 0.16 * (1 - rz / DEPTH) + 0.03;
            ctx.strokeStyle = 'rgba(255, 255, 255, ' + a.toFixed(3) + ')';
            ctx.strokeRect(cx - hw, cy - hw, hw * 2, hw * 2);
        }

        for (i = 0; i < pts.length; i++) {
            p = pts[i];
            if (p.z <= 1) spawn(p, true);
            k = FOCAL / p.z;
            sx = cx + p.x * k;
            sy = cy + p.y * k;
            if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;

            // Far dots crowd the vanishing point and must stay visible — that
            // crowd is what reads as the burst, so floor the alpha rather than
            // letting it fall to zero at max depth.
            a = 0.22 + 0.78 * (1 - p.z / DEPTH);
            r = 0.4 + 1.7 * (1 - p.z / DEPTH);
            ctx.fillStyle = p.warm
                ? 'rgba(255, 95, 31, ' + (a * 0.75).toFixed(3) + ')'
                : 'rgba(228, 228, 231, ' + (a * 0.62).toFixed(3) + ')';
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function tick() {
        speed += (targetSpeed - speed) * 0.05;
        var i;
        for (i = 0; i < pts.length; i++) pts[i].z -= speed;
        for (i = 0; i < rings.length; i++) {
            rings[i].z -= speed;
            if (rings[i].z <= 1) rings[i].z += DEPTH;
        }
        draw();
        if (running) frame = requestAnimationFrame(tick);
    }

    function start() { if (running) return; running = true; frame = requestAnimationFrame(tick); }
    function stop() { running = false; cancelAnimationFrame(frame); }

    window.addEventListener('resize', function () { resize(); if (!running) draw(); });

    // The stage can measure 0 on first paint (splash still holds the layout),
    // so track its box instead of trusting a single startup measurement.
    if (window.ResizeObserver) {
        new ResizeObserver(function () { resize(); if (!running) draw(); }).observe(canvas);
    }

    // Switching service punches the throttle briefly
    if (stage) {
        stage.addEventListener('fw:change', function () {
            targetSpeed = SPEED * 5;
            setTimeout(function () { targetSpeed = SPEED; }, 420);
        });

        new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) start(); else stop();
        }, { rootMargin: '10% 0px' }).observe(stage);
    }

    build();
    resize();
    draw();
    if (reduceMotion) return;
    if (stage && stage.getBoundingClientRect().top < window.innerHeight) start();
})();

/* ===== ADVISORY REGIMES — PINNED HORIZONTAL TRACK =====
   Vertical scroll drives horizontal travel. The section is a tall spacer whose
   surplus height is exactly the distance the track has to cover, so progress is
   a straight ratio and the pin releases on the frame the last panel lands.

   Three things this module refuses to do, each for a reason the codebase has
   already paid for once:

   - It never touches `transform`. The one-shot reveal owns that property on
     section children; this writes the standalone `translate` instead so the two
     can coexist on the same element.
   - It adds no free-running rAF loop. The hero-net already owns the one
     uncancelled full-screen repaint on the page. Work here is gated behind an
     IntersectionObserver and coalesced to one frame per scroll burst.
   - It measures nothing while html.intro-lock is set. The splash hides main and
     locks overflow, so every width read behind it would be a guess. */
;(() => {
    const section = document.querySelector('.regimes');
    const pin = document.querySelector('.regimes-pin');
    const viewport = document.querySelector('.regimes-viewport');
    const track = document.querySelector('.regime-track');
    if (!section || !pin || !viewport || !track) return;
    const panels = [...track.children];
    if (!panels.length) return;

    const terminal = document.querySelector('.terminal');
    const target = terminal && terminal.querySelector('.terminal-target');
    const status = terminal && terminal.querySelector('.terminal-bar b');
    const idleTarget = target ? target.textContent : '';
    const idleStatus = status ? status.textContent : '';

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover)');
    /* Touch devices keep the native scroller underneath. Lenis is already off
       there for the same reason - iOS does momentum better than we can, and a
       hand-driven pin is one more compositing layer on a device that answers
       layer pressure by dropping painted tiles. */
    const canPin = () => pointer.matches && !motion.matches;

    /* ---- read-out ---------------------------------------------------- */
    let typeTimer = 0;
    const write = (text) => {
        if (!target) return;
        clearInterval(typeTimer);
        if (motion.matches) { target.textContent = text; return; }
        terminal.classList.add('is-typing');
        let i = 0;
        target.textContent = '';
        typeTimer = setInterval(() => {
            i += 1;
            target.textContent = text.slice(0, i);
            if (i >= text.length) {
                clearInterval(typeTimer);
                terminal.classList.remove('is-typing');
            }
        }, 26);
    };

    let named = null;
    const name = (panel) => {
        if (panel === named) return;      // retyping the same line every frame
        named = panel;
        write(panel ? panel.dataset.regime : idleTarget);
        if (status) status.textContent = idleStatus;
    };

    /* The named panel also publishes the strip of viewport it occupies. The
       node field behind the page picks it up as an excitation band, so the same
       gesture that types the read-out lights the network across that panel. The
       canvas is fixed, so client coords are canvas coords - no transform. */
    let bandFrame = 0;
    const publishBand = () => {
        bandFrame = 0;
        if (!named) { window.dispatchEvent(new CustomEvent('pn:band')); return; }
        const r = named.getBoundingClientRect();
        window.dispatchEvent(new CustomEvent('pn:band', {
            detail: { x0: r.left, y0: r.top, y1: r.bottom }
        }));
    };
    const queueBand = () => { if (!bandFrame) bandFrame = requestAnimationFrame(publishBand); };

    const centrePanel = () => {
        const box = viewport.getBoundingClientRect();
        const mid = box.left + box.width / 2;
        return panels.find(p => {
            const r = p.getBoundingClientRect();
            return r.left <= mid && r.right > mid;
        }) || null;
    };

    /* ---- drive ------------------------------------------------------- */
    let travel = 0;
    let hovered = null;
    let live = false;
    let frame = 0;

    const apply = () => {
        frame = 0;
        if (!travel) return;
        const total = section.offsetHeight - pin.offsetHeight;
        if (total <= 0) return;
        const p = Math.min(1, Math.max(0, -section.getBoundingClientRect().top / total));
        track.style.translate = `${-(p * travel).toFixed(2)}px 0`;
        if (!hovered) name(centrePanel());
        queueBand();
    };
    const queue = () => { if (!frame && live) frame = requestAnimationFrame(apply); };

    const unpin = () => {
        section.classList.remove('is-pinned');
        section.style.removeProperty('--travel');
        track.style.removeProperty('translate');
        travel = 0;
    };

    const measure = () => {
        if (document.documentElement.classList.contains('intro-lock')) return;
        if (!canPin()) { if (section.classList.contains('is-pinned')) unpin(); return; }
        const next = Math.max(0, track.scrollWidth - viewport.clientWidth);
        if (next === travel && section.classList.contains('is-pinned')) return;
        travel = next;
        if (!travel) { unpin(); return; }
        section.style.setProperty('--travel', travel + 'px');
        section.classList.add('is-pinned');
        /* Document height just moved. CONVICTION BANDS caches
           scrollHeight - innerHeight and only refreshes on resize, so it has to
           be told, or its last band never reaches "grounded". */
        window.dispatchEvent(new Event('pn:remeasure'));
    };

    const refresh = () => { measure(); queue(); };

    /* ---- wiring ------------------------------------------------------ */
    new IntersectionObserver((entries) => {
        live = entries[0].isIntersecting;
        if (live) queue();
    }, { rootMargin: '15% 0px' }).observe(section);

    window.addEventListener('scroll', queue, { passive: true });

    const ro = new ResizeObserver(refresh);
    ro.observe(viewport);
    ro.observe(track);
    window.addEventListener('resize', refresh);
    motion.addEventListener('change', refresh);
    pointer.addEventListener('change', refresh);
    if (document.fonts) document.fonts.ready.then(refresh);

    panels.forEach(panel => {
        panel.addEventListener('pointerenter', () => { hovered = panel; name(panel); queueBand(); });
        /* Keyboard focus has to move the track too, or a panel can be focused
           while sitting outside a viewport with overflow:hidden - reachable by
           tab, invisible on screen. Scrolling the page is what moves it. */
        panel.addEventListener('focusin', () => {
            hovered = panel;
            name(panel);
            if (!travel) { panel.scrollIntoView({ block: 'nearest', inline: 'center' }); return; }
            const x = panels.slice(0, panels.indexOf(panel)).reduce((s, el) => s + el.offsetWidth, 0);
            const total = section.offsetHeight - pin.offsetHeight;
            window.scrollTo({ top: section.offsetTop + Math.min(1, x / travel) * total });
        });
    });
    viewport.addEventListener('pointerleave', () => { hovered = null; name(centrePanel()); });
    viewport.addEventListener('focusout', (e) => {
        if (!viewport.contains(e.relatedTarget)) { hovered = null; name(centrePanel()); }
    });

    /* Behind the splash every width is a guess, so wait for the lock to lift. */
    if (document.documentElement.classList.contains('intro-lock')) {
        const mo = new MutationObserver(() => {
            if (document.documentElement.classList.contains('intro-lock')) return;
            mo.disconnect();
            refresh();
        });
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    refresh();
})()

/* ===== CLOSING CTA RISE =====
   The beat straight after the regimes pin. The track releases on the last
   regime and the next scroll lifts this line up off the floor.

   Progress comes from the CTA's own rect, not from the track's, so it stays
   correct when the pin is not running at all - on touch, under reduced motion,
   or if the regimes module bailed early. Gated behind an IntersectionObserver
   for the same reason as everything else on this page: the hero-net already
   owns the one uncancelled full-screen repaint. */
;(() => {
    const cta = document.querySelector('.closing-cta');
    if (!cta) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover)');
    /* Phones paint the document whole from the first frame; nothing here slides
       in as you reach it. Reduced motion asks for the same. Both drop back to
       the CSS resting value, which is the finished frame. */
    const skip = () => motion.matches || !pointer.matches;

    let live = false;
    let frame = 0;

    const apply = () => {
        frame = 0;
        if (skip()) { cta.style.removeProperty('--open'); return; }
        const top = cta.getBoundingClientRect().top;
        // Shut while its top edge is still a screen below the fold, fully open
        // once it has climbed to 45% of the viewport.
        const shut = window.innerHeight;
        const open = window.innerHeight * 0.45;
        const p = Math.min(1, Math.max(0, (shut - top) / (shut - open)));
        cta.style.setProperty('--open', p.toFixed(3));
    };
    const queue = () => { if (!frame && live) frame = requestAnimationFrame(apply); };

    new IntersectionObserver((entries) => {
        live = entries[0].isIntersecting;
        if (live) queue();
    }, { rootMargin: '25% 0px' }).observe(cta);

    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    motion.addEventListener('change', queue);
    pointer.addEventListener('change', queue);
})()

/* ===== CONVICTION BANDS =====
   One pass per frame does both jobs. Whichever band crosses the middle of the
   viewport lights up, exactly as it always has — and every band also publishes
   where it sits as two custom properties, which the CONVICTION SCRUB block in
   styles.css turns into motion. Sharing the pass keeps it to one rect read per
   band per frame instead of two listeners racing over the same geometry.

   This module never writes a paintable property. Custom properties and class
   names only, so the one-shot scroll reveal — which owns `transform` and
   `opacity` on .conviction itself — has nothing to contend with. */
;(() => {
    /* Stacked lists only. Where the bands carry a claim they are laid out three
       across (see the trio block in styles.css), and three columns cross the
       middle of the viewport on the same frame - "whichever band is centred"
       stops naming anything, and lighting all three at once is the same as
       lighting none. Those rest at full strength and light on hover instead, so
       this module leaves them alone and never puts .is-parallax on them. */
    const lists = [...document.querySelectorAll('.convictions')]
        .filter(list => !list.querySelector('.conviction-claim'));
    const bands = lists.flatMap(list => [...list.querySelectorAll('.conviction')]);
    if (!bands.length) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    const SPAN = 0.5;      // must stay in step with --cv-span in styles.css
    const STEP_MAX = 0.14; // tightest useful gap between two words

    /* Claims are cut into words here rather than in the markup, so the three
       language pages keep them as plain translatable text with nothing to
       hand-sync. A claim that already contains markup — a <span class="key">
       like the ones in .about-statement — is left alone rather than having its
       elements eaten; that band simply renders as it does today. */
    const split = (band) => {
        const claim = band.querySelector('.conviction-claim');
        if (!claim || claim.children.length) return;
        const words = claim.textContent.trim().split(/\s+/).filter(Boolean);
        if (!words.length) return;

        const frag = document.createDocumentFragment();
        words.forEach((word, i) => {
            const span = document.createElement('span');
            span.className = 'cv-word';
            span.style.setProperty('--i', String(i));
            span.textContent = word;
            frag.appendChild(span);
            // Real space text nodes, so copy/paste and screen readers still get
            // a sentence rather than a list of words.
            if (i < words.length - 1) frag.appendChild(document.createTextNode(' '));
        });
        claim.textContent = '';
        claim.appendChild(frag);

        /* Derived, not fixed: whatever word count a translation turns out to
           have, the last word finishes rising exactly as the band settles. */
        const step = Math.min(STEP_MAX, (1 - SPAN) / Math.max(1, words.length - 1));
        band.style.setProperty('--cv-step', step.toFixed(3));
    };

    const state = bands.map(() => ({ p: -1, d: -9 }));
    let active = -1;
    let scrub = false;
    let scrollMax = 0;

    // scrollHeight is a layout read, so it is cached rather than sampled in the loop.
    const measure = () => {
        scrollMax = document.documentElement.scrollHeight - window.innerHeight;
    };

    const update = () => {
        const vh = window.innerHeight;
        const line = vh * 0.5;
        const enter = vh * 1.15;    // band centre here: the claim has not started setting
        const settle = vh * 0.72;   // ...and here it is fully set. Tuned so that when the
                                    //    last band lands, the first is still ~250px down
                                    //    the page and the section heading is on screen
                                    //    above it — the promise and all three fulfilments
                                    //    legible together.
        const travel = Math.max(1, enter - settle);
        // A band parked at the very bottom of the document could never climb to
        // the settle line, so pin it open once the page cannot scroll further.
        const grounded = window.scrollY >= scrollMax - 2;

        // Every measurement first, every write second: interleaving them would
        // make each band's style write invalidate the next band's rect.
        const rects = bands.map(el => el.getBoundingClientRect());

        let best = -1;
        let bestDist = Infinity;
        rects.forEach((r, i) => {
            if (r.bottom < 0 || r.top > vh) return;      // off-screen bands stay dark
            const dist = r.top <= line && r.bottom >= line
                ? 0
                : Math.min(Math.abs(r.top - line), Math.abs(r.bottom - line));
            if (dist < bestDist) { bestDist = dist; best = i; }
        });
        if (best !== active) {
            active = best;
            bands.forEach((el, i) => el.classList.toggle('is-active', i === best));
        }

        if (!scrub) return;

        rects.forEach((r, i) => {
            const s = state[i];
            const centre = r.top + r.height / 2;

            /* Measured from the centre, so a claim that wraps to three lines on
               a phone still starts and finishes with its neighbours instead of
               lagging by its own extra height. */
            const p = grounded ? 1 : clamp((enter - centre) / travel, 0, 1);
            /* +1 well below the fold, -1 well above it, and exactly 0 when the
               band's centre sits on `line` — the same line the picker above
               uses. That is what puts the three planes in register on the very
               frame the band takes .is-active. */
            const d = clamp((centre - line) / (line + r.height / 2), -1, 1);

            // Sub-thousandth moves are invisible, and skipping them keeps a
            // settled band off the style-invalidation path during momentum scroll.
            if (Math.abs(p - s.p) > 0.002) { s.p = p; bands[i].style.setProperty('--cv-p', p.toFixed(4)); }
            if (Math.abs(d - s.d) > 0.003) { s.d = d; bands[i].style.setProperty('--cv-d', d.toFixed(4)); }
        });
    };

    let queued = false;
    const onScroll = () => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; update(); });
    };

    const enable = () => {
        if (scrub) return;
        bands.forEach(split);
        scrub = true;
        measure();
        /* Values land BEFORE the gate class, so the first painted frame is
           already correct — no flash of finished type. And because the class
           goes on last, anything that threw above leaves the bands plainly
           visible rather than stranded mid-reveal. */
        update();
        lists.forEach(el => el.classList.add('is-parallax'));
    };

    const disable = () => {
        scrub = false;
        lists.forEach(el => el.classList.remove('is-parallax'));
    };

    const remeasure = () => { measure(); onScroll(); };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', remeasure);
    /* The pinned regimes track sizes its own spacer from measured widths, which
       moves document height without a resize. scrollMax is cached here, so
       without this the last band never reads as grounded. */
    window.addEventListener('pn:remeasure', remeasure);
    // The intro releasing the scroll lock and Outfit swapping in both move these
    // bands without firing a scroll event, and both land after this module runs.
    window.addEventListener('load', remeasure);
    if (document.fonts) document.fonts.ready.then(remeasure);
    if (motion.addEventListener) {
        motion.addEventListener('change', () => {
            if (motion.matches) disable(); else enable();
            update();
        });
    }

    measure();
    if (motion.matches) update(); else enable();
})()

/* ===== CONSOLE MARK + IDLE TITLE ===== */
;(() => {
    try {
        console.log(
            '%cPROJECT NIDOS',
            'color:#ff5f1f;font:700 22px Outfit,Inter,sans-serif;letter-spacing:.04em',
        );
        console.log(
            '%c> sistemas, nevis prezentacijas · 0 PowerPoint · support@projectnidos.eu',
            'color:#71717a;font:12px ui-monospace,monospace',
        );
    } catch (e) { /* consoles differ; the mark is optional */ }

    const idle = document.documentElement.lang === 'en'
        ? '[ AWAITING INPUT ] - Project Nidos'
        : '[ GAIDA IEVADI ] - Project Nidos';
    let realTitle = document.title;
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) { realTitle = document.title; document.title = idle; }
        else document.title = realTitle;
    });
})()

/* ===== EASTER EGG — footer square opens the arcade ===== */
;(() => {
    const egg = document.querySelector('.egg-arcade');
    if (!egg) return;

    egg.addEventListener('click', () => {
        const lang = egg.getAttribute('data-arcade-lang') === 'en' ? 'en' : 'lv';
        const url = `/arcade.html?lang=${lang}`;
        const w = Math.min(1100, screen.availWidth - 80);
        const h = Math.min(780, screen.availHeight - 80);
        const x = Math.round((screen.availWidth - w) / 2);
        const y = Math.round((screen.availHeight - h) / 2);

        /* Deliberately no `noopener`: the popup has to inherit this tab's
           sessionStorage or the site gate would ask for the password again. */
        const win = window.open(url, 'pn-arcade',
            `popup=yes,width=${w},height=${h},left=${x},top=${y}`);

        // Phones ignore popup geometry and blockers can return null — plain tab.
        if (!win) window.open(url, '_blank');
        else win.focus();
    });
})()
