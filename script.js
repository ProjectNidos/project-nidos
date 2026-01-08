document.addEventListener('DOMContentLoaded', () => {
    // --- Data Dictionary for Translations ---
    const i18n = {
        en: {
            nav_about: "About",
            nav_services: "Services",
            nav_why_us: "Why Us",
            nav_contact: "Contact Us",
            hero_slogan: "With Project Nidos",
            hero_title: 'Empowering Your <br><span class="gradient-text">Digital Transformation</span>',
            hero_subtitle: "We help profitable companies unlock their potential through digital innovation, EU grants, and strategic IT partnerships.",
            hero_cta: "Get Started",
            hero_services: "Our Services",
            about_title: "Bridging the Digital Gap",
            about_mission_title: "Our Mission",
            about_mission_text: "We specialize in helping successful companies take the next step. You have the profit, now it's time for the systems that scale.",
            about_approach_title: "Our Approach",
            about_approach_text: "From EU grant acquisition to implementing robust CRM & ERP systems, we handle the digitalization journey end-to-end.",
            services_title: "Comprehensive Solutions",
            service_strategy_title: "Digital Strategy",
            service_strategy_text: "Custom roadmaps for your digital evolution.",
            service_crm_title: "CRM & ERP Systems",
            service_crm_text: "Streamline operations with top-tier management software.",
            service_web_title: "Online Presence",
            service_web_text: "Professional websites and e-commerce solutions.",
            service_grants_title: "EU Grants",
            service_grants_text: "Navigating funding opportunities for your growth.",
            whyup_title: "Why Partner With Us?",
            benefit_1: "Expertise in EU Funding Ecosystems",
            benefit_2: "Network of Specialized IT Partners",
            benefit_3: "Tailored Solutions, Not Cookie-Cutter Fixes",
            benefit_4: "Focus on Profitable, Growth-Ready Companies",
            contact_title: "Let's Grow Together",
            contact_info_title: "Contact Information",
            form_name: "Name",
            form_email: "Email",
            form_message: "Message",
            form_submit: "Send Message"
        },
        lv: {
            nav_about: "Par mums",
            nav_services: "Pakalpojumi",
            nav_why_us: "Kāpēc mēs",
            nav_contact: "Kontakti",
            hero_slogan: "Kopā ar Projekts Ligzda",
            hero_title: 'Veiciniet Savu <br><span class="gradient-text">Digitālo Transformāciju</span>',
            hero_subtitle: "Mēs palīdzam pelnošiem uzņēmumiem atraisīt potenciālu caur digitālām inovācijām, ES grantiem un stratēģiskām IT partnerībām.",
            hero_cta: "Sākt sadarbību",
            hero_services: "Pakalpojumi",
            about_title: "Digitālās Izaugsmes Tilts",
            about_mission_title: "Mūsu Misija",
            about_mission_text: "Mēs specializējamies, palīdzot veiksmīgiem uzņēmumiem spert nākamo soli. Jums ir peļņa, tagad ir laiks sistēmai, kas ļauj augt.",
            about_approach_title: "Mūsu Pieeja",
            about_approach_text: "No ES grantu piesaistes līdz spēcīgu CRM un ERP sistēmu ieviešanai - mēs vadām digitalizācijas procesu no sākuma līdz beigām.",
            services_title: "Visaptveroši Risinājumi",
            service_strategy_title: "Digitālā Stratēģija",
            service_strategy_text: "Pielāgoti ceļveži jūsu digitālajai attīstībai.",
            service_crm_title: "CRM un ERP Sistēmas",
            service_crm_text: "Optimizējiet darbību ar augstākās klases pārvaldības programmatūru.",
            service_web_title: "Tiešsaistes Klātbūtne",
            service_web_text: "Profesionālas mājaslapas un e-komercijas risinājumi.",
            service_grants_title: "ES Granti",
            service_grants_text: "Finansējuma piesaiste jūsu izaugsmei.",
            whyup_title: "Kāpēc Sadarboties?",
            benefit_1: "Ekspertīze ES finansējuma ekosistēmās",
            benefit_2: "Specializētu IT partneru tīkls",
            benefit_3: "Pielāgoti risinājumi, nevis šabloni",
            benefit_4: "Fokuss uz pelnošiem, augošiem uzņēmumiem",
            contact_title: "Augsim Kopā",
            contact_info_title: "Kontaktinformācija",
            form_name: "Vārds",
            form_email: "E-pasts",
            form_message: "Ziņa",
            form_submit: "Nosūtīt ziņu"
        }
    };

    // --- Language Switching Logic ---
    const langBtns = document.querySelectorAll('.lang-btn');
    const elementsToTranslate = document.querySelectorAll('[data-i18n]');
    let currentLang = 'en';

    function setLanguage(lang) {
        // Update Content
        elementsToTranslate.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[lang][key]) {
                // If the content involves HTML (marked in our dict with HTML tags), use innerHTML
                if (i18n[lang][key].includes('<')) {
                    el.innerHTML = i18n[lang][key];
                } else {
                    el.textContent = i18n[lang][key];
                }
            }
        });

        currentLang = lang;

        // Update Active Button State
        langBtns.forEach(btn => {
            if (btn.getAttribute('data-lang') === lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Optional: Save preference
        // localStorage.setItem('prefLang', lang); 
    }

    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            setLanguage(lang);
        });
    });

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
            const res = await fetch('http://localhost:4000/api/webhooks/form-lead', {
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

            currentStep += 1;

            if (currentStep < currentQuestions.length) {
                addChatMessage(currentQuestions[currentStep]);
            } else {
                const nameAnswer = answers[answers.length - 2]?.answer || '';
                const emailAnswer = answers[answers.length - 1]?.answer || '';

                if (!emailAnswer || !emailAnswer.includes('@')) {
                    const invalidMsg = messagesByLang[currentLang]?.invalidEmail || messagesByLang.en.invalidEmail;
                    addChatMessage(invalidMsg, 'bot');
                    currentStep = currentQuestions.length - 1; // repeat email question
                    return;
                }

                const thankYouMsg = messagesByLang[currentLang]?.thankYou || messagesByLang.en.thankYou;
                addChatMessage(thankYouMsg, 'bot');

                await submitServiceLeadToCRM({
                    name: nameAnswer,
                    email: emailAnswer,
                    phone: '',
                    message: answers.map(a => `${a.question} ${a.answer}`).join('\n'),
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

            const name = nameInput?.value.trim() || '';
            const email = emailInput?.value.trim() || '';
            const message = messageInput?.value.trim() || '';

            if (!email) {
                alert('Please enter your email.');
                return;
            }

            try {
                const res = await fetch('http://localhost:4000/api/webhooks/form-lead', {
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

    // --- Smooth Scroll handled by CSS ---
});
