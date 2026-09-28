/*
 * The menu and footer every page shares, as fields: the same types and the same
 * validator as a block's (server/cms/fields.js), so the admin draws them with the
 * same form. A menu link's section shortcut (its anchor) is not a field - the
 * editor sets it from the address (server/cms/editor-rules.js, checkSite).
 */
const LINK = { type: 'link', label: 'Address', required: true };

const SITE_FIELDS = {
  nav: { type: 'group', label: 'Menu', required: true, of: {
    logo: { type: 'text', label: 'Site name', max: 40, required: true },
    links: { type: 'list', label: 'Links', min: 1, max: 8, of: {
      text: { type: 'text', label: 'Words', max: 24, required: true },
      href: LINK,
    } },
  } },
  footer: { type: 'group', label: 'Footer', required: true, of: {
    taglineHTML: { type: 'richtext', label: 'Tagline', max: 300, profile: 'inline', required: true },
    cols: { type: 'list', label: 'Columns', min: 1, max: 4, of: {
      heading: { type: 'text', label: 'Heading', max: 32, required: true },
      links: { type: 'list', label: 'Links', min: 1, max: 8, of: {
        text: { type: 'text', label: 'Words', max: 40, required: true },
        href: LINK,
      } },
    } },
    legal: { type: 'longtext', label: 'Legal line', max: 300, required: true },
    arcade: { type: 'group', label: 'Arcade button', required: true, of: {
      text: { type: 'text', label: 'Text', max: 40, required: true },
      aria: { type: 'text', label: 'Screen-reader label', max: 80, required: true },
    } },
  } },
  labels: { type: 'group', label: 'Other labels', required: true, of: {
    skip: { type: 'text', label: '"Skip to content" link', max: 40, required: true },
    menu: { type: 'text', label: 'Menu button (screen readers)', max: 40, required: true },
    introSkip: { type: 'text', label: 'Intro skip button', max: 24, required: true },
  } },
};

module.exports = { SITE_FIELDS };
