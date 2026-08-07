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

    function hideBanner() {
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


// Inject premium momentum scrolling (Lenis) globally
const lenisScript = document.createElement('script');
lenisScript.src = 'https://unpkg.com/lenis@1.1.20/dist/lenis.min.js';
lenisScript.onload = () => {
    const lenis = new Lenis({
        autoRaf: true,
        lerp: 0.06,
        smoothWheel: true
    });
};
document.head.appendChild(lenisScript);

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
            introScreen.classList.add('slide-up');
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
            // The select is qualification data the endpoint has no field for,
            // so it rides along on the message rather than being dropped.
            const interest = interestInput?.selectedOptions[0]?.text.trim() || '';
            const body = messageInput?.value.trim() || '';
            const message = interest ? `[${interest}] ${body}` : body;

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
                    body: JSON.stringify({
                        name,
                        email,
                        phone: '',
                        message,
                        source: 'website_contact_form'
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

    var DENSITY = 3800;      // px^2 per node
    var LINK_DIST = 190;
    var NODE_ALPHA = 0.7;
    var LINE_ALPHA = 0.26;
    var SPEED = 0.3;
    var NODE_R = 2.1;
    var MAX_NODES = 220;

    var W = 0, H = 0, nodes = [];
    var mouse = { x: -9999, y: -9999 };

    function resize() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        W = canvas.clientWidth;
        H = canvas.clientHeight;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        seed();
        if (reduceMotion) draw();
    }

    function seed() {
        var count = Math.min(Math.round((W * H) / DENSITY), MAX_NODES);
        nodes = [];
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
        var i, j, a, b, dx, dy, d2, t;
        for (i = 0; i < nodes.length; i++) {
            a = nodes[i];
            for (j = i + 1; j < nodes.length; j++) {
                b = nodes[j];
                dx = a.x - b.x; dy = a.y - b.y;
                d2 = dx * dx + dy * dy;
                if (d2 < LINK_DIST * LINK_DIST) {
                    t = 1 - Math.sqrt(d2) / LINK_DIST;
                    ctx.strokeStyle = 'rgba(255, 138, 68, ' + (LINE_ALPHA * t).toFixed(3) + ')';
                    ctx.lineWidth = 1;
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
            ctx.beginPath();
            ctx.arc(a.x, a.y, NODE_R, 0, Math.PI * 2);
            ctx.fill();
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
        draw();
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
    window.addEventListener('resize', resize);

    resize();
    if (!reduceMotion) requestAnimationFrame(tick);
})();

/* ===== SERVICES FRAMEWORK =====
   Left rail scrolls, right stage stays pinned. The item crossing the
   focus line becomes active and the stage caption swaps to match. */
;(() => {
    const stage = document.querySelector('.fw-stage');
    const items = [...document.querySelectorAll('.fw-item')];
    if (!stage || !items.length) return;

    const phaseEl = stage.querySelector('.fw-stage-phase');
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
            phaseEl.textContent = item.dataset.phase;
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

/* ===== ADVISORY TERMINAL =====
   Reports whichever regime row the pointer or keyboard is on, and falls back
   to its idle line on the way out. */
;(() => {
    const terminal = document.querySelector('.terminal');
    const rows = [...document.querySelectorAll('.regime-row')];
    if (!terminal || !rows.length) return;

    const target = terminal.querySelector('.terminal-target');
    const status = terminal.querySelector('.terminal-bar b');
    if (!target || !status) return;

    const idleTarget = target.textContent;
    const idleStatus = status.textContent;

    const set = (row) => {
        target.textContent = row ? row.dataset.regime : idleTarget;
        status.textContent = row
            ? (row.querySelector('.regime-badge')?.textContent.trim().toUpperCase() || idleStatus)
            : idleStatus;
    };

    rows.forEach(row => {
        row.addEventListener('pointerenter', () => set(row));
        row.addEventListener('focusin', () => set(row));
    });
    const list = rows[0].parentElement;
    list.addEventListener('pointerleave', () => set(null));
    list.addEventListener('focusout', (e) => {
        if (!list.contains(e.relatedTarget)) set(null);
    });
})()
