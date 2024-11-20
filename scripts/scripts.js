import {
  sampleRUM,
  getLanguagePath,
  buildBlock,
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  fetchPlaceholders,
  waitForLCP,
  loadBlocks,
  toClassName,
  getMetadata,
  loadCSS,
  toCamelCase,
} from './lib-franklin.js';
import TEMPLATE_LIST from '../templates/config.js';

const AUDIENCES = {
  mobile: () => window.innerWidth < 600,
  desktop: () => window.innerWidth >= 600,
  // define your custom audiences here as needed
};

/**
 * Gets all the metadata elements that are in the given scope.
 * @param {String} scope The scope/prefix for the metadata
 * @returns an array of HTMLElement nodes that match the given scope
 */
export function getAllMetadata(scope) {
  return [...document.head.querySelectorAll(`meta[property^="${scope}:"],meta[name^="${scope}-"]`)]
    .reduce((res, meta) => {
      const id = toClassName(meta.name
        ? meta.name.substring(scope.length + 1)
        : meta.getAttribute('property').split(':')[1]);
      res[id] = meta.getAttribute('content');
      return res;
    }, {});
}

// Define an execution context
const pluginContext = {
  getAllMetadata,
  getMetadata,
  loadCSS,
  sampleRUM,
  toCamelCase,
  toClassName,
};

const LCP_BLOCKS = []; // add your LCP blocks to the list
window.hlx.RUM_GENERATION = 'project-1'; // add your RUM generation information here

/**
 * Adds chevron to all buttons that are children of element
 * @param element The dom subtree containing buttons
 * @param selector The selector to match buttons
 */
export function addChevronToButtons(element, selector = 'a.button') {
  /* Add chevron to buttons */
  element.querySelectorAll(selector).forEach((button) => {
    const chevron = document.createElement('span');
    chevron.classList.add('icon', 'icon-chevron-right');
    button.append(chevron);
  });
}

/**
 * decorates paragraphs containing a single link as buttons with classes and
 * chevron icon.
 * @param {Element} element container element
 */
function decorateButtons(element) {
  element.querySelectorAll('a').forEach((a) => {
    if (a.href !== a.textContent) {
      const up = a.parentElement;
      const twoup = up.parentElement;
      const threeUp = twoup.parentElement;

      if (!a.querySelector('img') && !threeUp.classList.contains('fixed-social-media')) {
        a.title = a.title || a.textContent.trim();
        if (up.childNodes.length === 1 && (up.tagName === 'P' || up.tagName === 'DIV')) {
          a.className = 'button'; // default navigational link
          up.classList.add('button-container');
        }
        if (up.childNodes.length === 1 && up.tagName === 'STRONG'
          && twoup.childNodes.length === 1 && twoup.tagName === 'P') {
          a.className = 'button primary'; // primary CTA button link
          twoup.classList.add('button-container');
        }
        if (up.childNodes.length === 1 && up.tagName === 'EM'
          && twoup.childNodes.length === 1 && twoup.tagName === 'P') {
          a.className = 'button secondary'; // secondary CTA button link
          twoup.classList.add('button-container');
        }
        addChevronToButtons(up);
      }
    }
  });
}

function buildHeroBlock(main) {
  /* 1. If there is an explicit hero block, add it to its own section, so it can be full-width */
  const heroBlock = main.querySelector('.hero');
  if (heroBlock) {
    const section = document.createElement('div');
    section.append(heroBlock);
    main.prepend(section);
    return;
  }

  /* 2. If we are on a blog post with image, add the image and h1 */
  const h1 = main.querySelector('h1');
  let picture;
  let subtitle;

  const h1Sibling = document.querySelector('body.blogpost main h1 + p');

  if (h1Sibling && h1Sibling.firstElementChild?.nodeName === 'PICTURE') {
    picture = h1Sibling;
  } else if (h1Sibling && h1Sibling.nextElementSibling?.firstElementChild?.nodeName === 'PICTURE') {
    picture = h1Sibling.nextElementSibling?.firstElementChild;
    subtitle = h1Sibling;
  }

  if (h1 && picture) {
    const section = document.createElement('div');
    const hr = document.createElement('hr');
    section.append(buildBlock('hero', { elems: [hr, h1, subtitle, picture] }));
    main.prepend(section);
    return;
  }

  /* 3. If there is only a h1, build a block out of the h1 */
  if (h1) {
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [h1] }));
    main.prepend(section);
  }
}

/**
 * Returns a Franklin icon span (that will be expanded by decorateIcons)
 * @param {string} name The icon file name (minus ".svg")
 * @returns {HTMLSpanElement}
 */
export function createIcon(name) {
  const icon = document.createElement('span');
  icon.classList.add('icon', `icon-${name}`);

  return icon;
}

async function fetchAndSetIframeTitle(urlVendor, iframe) {
  try {
    const response = await fetch(urlVendor);
    const data = await response.json();
    iframe.setAttribute('title', data.title);
  } catch (error) {
    // eslint-disable-next-line vars-on-top
    console.error('Error:', error);
  }
}

function createEmbedIFrame(a, vendor) {
  const div = document.createElement('div');
  div.classList.add(`${vendor}-base`);
  const id = a.pathname.split('/').pop();

  let source;
  let className;
  let allow;
  let urlVendor;

  if (vendor === 'youtube') {
    source = `https://www.youtube.com/embed/${id}`;
    className = 'youtube-player';
    allow = 'encrypted-media; accelerometer; gyroscope; picture-in-picture';
    urlVendor = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
  } else if (vendor === 'spotify') {
    source = `https://open.spotify.com/embed/episode/${id}`;
    className = 'spotify-player';
    allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
    urlVendor = 'https://open.spotify.com/oembed?url=https://open.spotify.com/episode/78DmMlPuBgkPzziPKx8oko';
  } else if (vendor === 'wistia') {
    source = `https://fast.wistia.net/embed/iframe/${id}`;
    className = 'wistia-player';
    allow = 'autoplay; clipboard-write; encrypted-media; fullscreen;';
    urlVendor = `https://fast.wistia.com/oembed/?url=https://fast.wistia.net/embed/iframe/${id}&format=json`;
  }

  div.innerHTML = `<iframe data-src="${source}" 
        class="${className}"
        allowfullscreen  
        allow="${allow}"
        style="display: none"
        loading="auto">
    </iframe>`;

  a.replaceWith(div);
  const iframe = div.querySelector('iframe');
  fetchAndSetIframeTitle(urlVendor, iframe);
  return div;
}

function preDecorateEmbed(main) {
  const lazyEmbeds = [];

  const anchors = main.getElementsByTagName('a');
  const youTubeAnchors = Array.from(anchors).filter((a) => a.href.includes('youtu') && encodeURI(a.textContent.trim()).indexOf(a.href) !== -1);
  const spotifyAnchors = Array.from(anchors).filter((a) => a.href.includes('spotify') && encodeURI(a.textContent.trim()).indexOf(a.href) !== -1);
  const wistiaAnchors = Array.from(anchors).filter((a) => a.href.includes('wistia') && encodeURI(a.textContent.trim()).indexOf(a.href) !== -1);

  youTubeAnchors.forEach((a) => {
    lazyEmbeds.push(createEmbedIFrame(a, 'youtube'));
  });
  spotifyAnchors.forEach((a) => {
    lazyEmbeds.push(createEmbedIFrame(a, 'spotify'));
  });
  wistiaAnchors.forEach((a) => {
    lazyEmbeds.push(createEmbedIFrame(a, 'wistia'));
  });

  if ('IntersectionObserver' in window) {
    // eslint-disable-next-line vars-on-top
    const lazyEmbedObserver = new IntersectionObserver((entries) => {
      entries.forEach((embed) => {
        if (embed.isIntersecting) {
          const iframe = embed.target.firstChild;
          iframe.src = iframe.dataset.src;
          iframe.style.display = iframe.style.display === 'none' ? '' : 'none';
          lazyEmbedObserver.unobserve(embed.target);
        }
      });
    });

    lazyEmbeds.forEach((lazyEmbed) => {
      lazyEmbedObserver.observe(lazyEmbed);
    });
  } else {
    lazyEmbeds.forEach((embed) => {
      const iframe = embed.querySelector('iframe');
      iframe.src = iframe.dataset.src;
      iframe.style.display = iframe.style.display === 'none' ? '' : 'none';
    });
  }
}

export function isMarketoFormUrl(url) {
  return url.hostname === 'engage-lon.marketo.com';
}

function findParent(element, callback) {
  if (!element.parentElement) {
    return null;
  }
  if (callback(element.parentElement)) {
    return element.parentElement;
  }
  return findParent(element.parentElement, callback);
}

function preDecorateMarketoForm(main) {
  [...main.getElementsByTagName('a')].filter((a) => {
    try {
      return a.href
        && isMarketoFormUrl(new URL(a.href))
        && !findParent(a, (parent) => parent.classList.contains('form'));
    } catch (e) {
      console.error('error while parsing form anchors', e); // eslint-disable-line no-console
      return false;
    }
  }).forEach((a) => {
    const formDiv = document.createElement('div');
    formDiv.classList.add('form');
    formDiv.innerHTML = `<div><div>${a.outerHTML}</div></div>`;
    a.parentElement.replaceWith(formDiv);
  });
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
async function buildAutoBlocks(main) {
  try {
    buildHeroBlock(main);
    const template = toClassName(getMetadata('template'));
    const templates = TEMPLATE_LIST;
    if (templates.includes(template)) {
      const mod = await import(`../templates/${template}/${template}.js`);
      if (mod.default) {
        await mod.default(main);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Instruments the main element with document metadata for LiveUX tracking
 * @param {*} main The main element
 */
function instrumentMain(main) {
  [...document.head.children]
    .filter((child) => child.nodeName === 'META' && child.name.startsWith('wp-'))
    .forEach((meta) => main.setAttribute(`data-${meta.name}`, meta.content));
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export async function decorateMain(main) {
  instrumentMain(main);
  // hopefully forward compatible button decoration
  decorateButtons(main);
  preDecorateMarketoForm(main);
  await buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  preDecorateEmbed(main);
}

/**
 * Lazy loads Gellix font from css file
 */
async function loadGellix() {
  await loadCSS('/styles/lazy-styles.css');
}

/**
 * sets the language attribute in the html tag
 */
function setPageLanguage() {
  let languagePath = getLanguagePath();

  if (languagePath) {
    languagePath = languagePath.slice(1);
  } else {
    languagePath = 'en';
  }
  document.documentElement.lang = languagePath;
}

/**
 * loads everything needed to get to LCP.
 */
async function loadEager(doc) {
  if (getMetadata('experiment')
    || Object.keys(getAllMetadata('campaign')).length
    || Object.keys(getAllMetadata('audience')).length) {
    // eslint-disable-next-line import/no-relative-packages
    const { loadEager: runEager } = await import('../plugins/experimentation/src/index.js');
    await runEager(document, { audiences: AUDIENCES }, pluginContext);
  }
  setPageLanguage();
  decorateTemplateAndTheme();
  await fetchPlaceholders();
  loadHeader(doc.querySelector('header'));
  const main = doc.querySelector('main');
  if (main) {
    await decorateMain(main);
    if (document.querySelector('main .section:first-child img')) {
      await waitForLCP(LCP_BLOCKS);
    } else {
      document.querySelector('body').classList.add('appear');
    }
    await loadGellix();
  }
}

/**
 * Adds the favicon.
 * @param {string} href The favicon URL
 */
export function addFavIcon(href) {
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  const existingLink = document.querySelector('head link[rel="icon"]');
  if (existingLink) {
    existingLink.parentElement.replaceChild(link, existingLink);
  } else {
    document.getElementsByTagName('head')[0].appendChild(link);
  }
}

/**
 * loads everything that doesn't need to be delayed.
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadBlocks(main);
  decorateIcons(main);

  const { hash } = window.location;
  const element = hash ? main.querySelector(hash) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  addFavIcon(`${window.hlx.codeBasePath}/icons/favicon.ico`);
  sampleRUM('lazy');
  sampleRUM.observe(main.querySelectorAll('div[data-block-name]'));
  sampleRUM.observe(main.querySelectorAll('picture > img'));

  if ((getMetadata('experiment')
    || Object.keys(getAllMetadata('campaign')).length
    || Object.keys(getAllMetadata('audience')).length)) {
    // eslint-disable-next-line import/no-relative-packages
    const { loadLazy: runLazy } = await import('../plugins/experimentation/src/index.js');
    await runLazy(document, { audiences: AUDIENCES }, pluginContext);
  }
}

/**
 * loads everything that happens a lot later, without impacting
 * the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();

const params = new URLSearchParams(window.location.search);
if (params.get('performance')) {
  window.hlx.performance = true;
  import('./performance.js').then((mod) => {
    if (mod.default) mod.default();
  });
}
