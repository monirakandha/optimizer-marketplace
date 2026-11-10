chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ANALYZE_LISTING") {
    const host = window.location.hostname;
    let data = null;
    let marketplace = "Unknown";

    if (host.includes("walmart.")) {
      data = extractWalmartData();
      marketplace = "Walmart";
    } else if (host.includes("amazon.")) {
      data = extractAmazonData();
      marketplace = "Amazon";
    } else if (host.includes("ebay.")) {
      data = extractEbayData();
      marketplace = "eBay";
    } else if (host.includes("target.")) {
      data = extractTargetData();
      marketplace = "Target";
    } else if (host.includes("bestbuy.")) {
      data = extractBestBuyData();
      marketplace = "BestBuy";
    }

    if (data) {
      data.domain = window.location.hostname;
      const analysis = analyzeListing(data, marketplace);
      sendResponse(analysis);
    } else {
      sendResponse({ error: "Unsupported marketplace." });
    }
  }
  return true;
});

const STATUS = {
  OBSERVED: 'OBSERVED',
  NOT_EXTRACTED: 'NOT_EXTRACTED',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
};

function observedValue(value) {
  return { status: STATUS.OBSERVED, value };
}

function statusOnly(status) {
  return { status, value: null };
}

function textStatus(text, observedStatus) {
  return { status: observedStatus, text: text || '' };
}

function parseNumberFromText(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseIntFromText(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, '').match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

function extractWalmartData() {
  const title = document.querySelector('h1')?.innerText.trim() || '';
  const priceText = document.querySelector('span[itemprop="price"]')?.innerText.trim() || '';
  const price = priceText ? { status: STATUS.OBSERVED, value: priceText, numeric: parseNumberFromText(priceText) } : statusOnly(STATUS.NOT_EXTRACTED);

  const thumbButtons = document.querySelectorAll('button[data-testid="item-page-image-thumbnail"]');
  const heroImgs = document.querySelectorAll('img[data-testid="hero-image"]');
  let imageCount;
  if (thumbButtons.length > 0) imageCount = observedValue(thumbButtons.length);
  else if (heroImgs.length > 0) imageCount = observedValue(heroImgs.length);
  else imageCount = statusOnly(STATUS.NOT_EXTRACTED);

  const aboutSection = document.querySelector('section[data-testid="product-description"]') || document.querySelector('.about-item') || document.querySelector('.product-description');
  const dangerous = document.querySelector('.dangerous-html');
  let description;
  if (aboutSection) {
    description = textStatus(aboutSection.innerText.trim(), STATUS.OBSERVED);
  } else if (dangerous) {
    description = textStatus(dangerous.innerText.trim(), STATUS.OBSERVED);
  } else {
    description = textStatus('', STATUS.NOT_EXTRACTED);
  }

  const bulletPoints = aboutSection ? observedValue(aboutSection.querySelectorAll('li').length) : statusOnly(STATUS.NOT_EXTRACTED);

  // Walmart review extraction on product page is not reliably isolated here; avoid false attribution.
  const reviews = statusOnly(STATUS.NOT_EXTRACTED);

  return { title, price, imageCount, description, bulletPoints, reviews };
}

function extractAmazonData() {
  const title = document.getElementById('productTitle')?.innerText.trim() || '';
  const priceText = document.querySelector('.a-price .a-offscreen')?.innerText.trim() ||
                    document.querySelector('#corePriceDisplay_desktop_feature_div .a-price-whole')?.innerText.trim() || '';
  const price = priceText ? { status: STATUS.OBSERVED, value: priceText, numeric: parseNumberFromText(priceText) } : statusOnly(STATUS.NOT_EXTRACTED);

  const altImages = document.querySelectorAll('#altImages li.item');
  const imageCount = altImages.length > 0 ? observedValue(altImages.length) : statusOnly(STATUS.NOT_EXTRACTED);

  const descEl = document.getElementById('productDescription');
  const description = descEl ? textStatus(descEl.innerText.trim(), STATUS.OBSERVED) : textStatus('', STATUS.NOT_EXTRACTED);

  const bullets = document.querySelectorAll('#feature-bullets li span.a-list-item');
  const bulletPoints = bullets.length > 0 ? observedValue(bullets.length) : statusOnly(STATUS.NOT_EXTRACTED);

  const reviewCountText = document.querySelector('#acrCustomerReviewText')?.innerText.trim() || '';
  const parsedReviews = parseIntFromText(reviewCountText);
  const reviews = parsedReviews != null ? observedValue(parsedReviews) : statusOnly(STATUS.NOT_EXTRACTED);

  return { title, price, imageCount, description, bulletPoints, reviews };
}

function extractEbayData() {
  const title = document.querySelector('.x-item-title__mainTitle')?.innerText.trim() || '';
  const priceText = document.querySelector('.x-price-primary .ux-textspans')?.innerText.trim() || '';
  const price = priceText ? { status: STATUS.OBSERVED, value: priceText, numeric: parseNumberFromText(priceText) } : statusOnly(STATUS.NOT_EXTRACTED);

  const imgs = document.querySelectorAll('.ux-image-carousel-item img');
  const imageCount = imgs.length > 0 ? observedValue(imgs.length) : statusOnly(STATUS.NOT_EXTRACTED);

  // eBay descriptions are often in iframes and not accessible; do not treat as empty verified description.
  const specifics = document.querySelector('.x-item-specifics');
  const description = specifics
    ? textStatus(specifics.innerText.trim(), STATUS.OBSERVED)
    : textStatus('', STATUS.UNAVAILABLE);

  const bulletPoints = specifics ? observedValue(specifics.querySelectorAll('ul li').length) : statusOnly(STATUS.NOT_EXTRACTED);

  // Seller feedback shown in seller card is not product reviews; do not extract as reviewCount.
  const reviews = statusOnly(STATUS.NOT_APPLICABLE);

  return { title, price, imageCount, description, bulletPoints, reviews };
}

function extractTargetData() {
  const title = document.querySelector('h1[data-test="product-title"]')?.innerText.trim() || document.querySelector('h1')?.innerText.trim() || '';
  const priceText = document.querySelector('[data-test="product-price"]')?.innerText.trim() || '';
  const price = priceText ? { status: STATUS.OBSERVED, value: priceText, numeric: parseNumberFromText(priceText) } : statusOnly(STATUS.NOT_EXTRACTED);

  const thumbs = document.querySelectorAll('[data-test="image-gallery-thumbnail"]');
  const imageCount = thumbs.length > 0 ? observedValue(thumbs.length) : statusOnly(STATUS.NOT_EXTRACTED);

  const descEl = document.querySelector('[data-test="item-details-description"]') || document.querySelector('#product-details-tabs');
  const description = descEl ? textStatus(descEl.innerText.trim(), STATUS.OBSERVED) : textStatus('', STATUS.NOT_EXTRACTED);

  const specs = document.querySelectorAll('[data-test="item-details-specifications"] li');
  const bulletPoints = specs.length > 0 ? observedValue(specs.length) : statusOnly(STATUS.NOT_EXTRACTED);

  const reviews = statusOnly(STATUS.NOT_EXTRACTED);
  return { title, price, imageCount, description, bulletPoints, reviews };
}

function extractBestBuyData() {
  const title = document.querySelector('.sku-title h1')?.innerText.trim() || document.querySelector('h1')?.innerText.trim() || '';
  const priceText = document.querySelector('.priceView-hero-price.priceView-customer-price span')?.innerText.trim() || '';
  const price = priceText ? { status: STATUS.OBSERVED, value: priceText, numeric: parseNumberFromText(priceText) } : statusOnly(STATUS.NOT_EXTRACTED);

  const thumbs = document.querySelectorAll('.thumbnail-list .media-thumbnail');
  const imageCount = thumbs.length > 0 ? observedValue(thumbs.length) : statusOnly(STATUS.NOT_EXTRACTED);

  const descEl = document.querySelector('.features-list') || document.querySelector('.html-container');
  const description = descEl ? textStatus(descEl.innerText.trim(), STATUS.OBSERVED) : textStatus('', STATUS.NOT_EXTRACTED);

  const feats = document.querySelectorAll('.features-list .feature-item');
  const bulletPoints = feats.length > 0 ? observedValue(feats.length) : statusOnly(STATUS.NOT_EXTRACTED);

  const reviews = statusOnly(STATUS.NOT_EXTRACTED);
  return { title, price, imageCount, description, bulletPoints, reviews };
}

function countWords(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function analyzeListing(data, marketplace) {
  const checks = [];
  let score = 100;
  const title = data && data.title ? String(data.title) : '';
  const imageCount = data && data.imageCount && data.imageCount.status === STATUS.OBSERVED ? data.imageCount.value : null;
  const descStatus = data && data.description ? data.description.status : STATUS.NOT_EXTRACTED;
  const descText = data && data.description && descStatus === STATUS.OBSERVED ? String(data.description.text || '') : '';
  const descWords = descStatus === STATUS.OBSERVED ? countWords(descText) : null;
  const bulletCount = data && data.bulletPoints && data.bulletPoints.status === STATUS.OBSERVED ? data.bulletPoints.value : null;
  const reviewCount = data && data.reviews && data.reviews.status === STATUS.OBSERVED ? data.reviews.value : null;

  if (!title) {
    checks.push({ status: 'error', title: 'Missing Title', message: 'Product title was not extracted.', solution: 'Ensure the listing has a clear, descriptive title visible on the page.' });
    score -= 25;
  } else if (title.length < 50) {
    checks.push({ status: 'warning', title: 'Short Title', message: `Title is ${title.length} characters. Consider adding relevant details if appropriate for the marketplace.`, solution: 'Add clear product details (brand, model, key attributes) without keyword stuffing.' });
    score -= 10;
  } else if (title.length > 150) {
    checks.push({ status: 'warning', title: 'Long Title', message: `Title is ${title.length} characters. Very long titles can reduce readability.`, solution: 'Prioritize the most important product details earlier in the title and remove repetition.' });
    score -= 5;
  } else {
    checks.push({ status: 'success', title: 'Title Length Observed', message: `Title is ${title.length} characters.`, solution: 'Keep it accurate and aligned with marketplace guidelines.' });
  }

  if (imageCount == null) {
    checks.push({ status: 'warning', title: 'Image Count Not Verified', message: `Image count is ${data && data.imageCount ? data.imageCount.status : STATUS.NOT_EXTRACTED}.`, solution: 'Manually confirm the number and quality of listing images in the marketplace editor.' });
  } else if (imageCount < 4) {
    checks.push({ status: 'warning', title: 'Limited Images Observed', message: `${imageCount} image(s) observed. Image needs vary by marketplace and listing type.`, solution: 'Review marketplace image guidelines and add additional clear, high-quality images if available.' });
    score -= 15;
  } else {
    checks.push({ status: 'success', title: 'Multiple Images Observed', message: `${imageCount} image(s) observed.`, solution: 'Confirm images meet marketplace quality and content guidelines.' });
  }

  if (descStatus === STATUS.NOT_EXTRACTED || descStatus === STATUS.UNAVAILABLE) {
    checks.push({ status: 'warning', title: 'Description Not Verified', message: `Description content is ${descStatus}. It may exist but be inaccessible to this extractor.`, solution: 'Manually review the listing description in the marketplace editor for completeness and clarity.' });
  } else if (descWords < 50) {
    checks.push({ status: 'warning', title: 'Short Description Observed', message: `Description has ${descWords} observed word(s).`, solution: 'Consider adding clear product details, materials, dimensions, and use cases where relevant.' });
    score -= 10;
  } else {
    checks.push({ status: 'success', title: 'Description Observed', message: `Description has ${descWords} observed word(s).`, solution: 'Ensure information is accurate and consistent with the product.' });
  }

  if (marketplace === 'eBay') {
    if (bulletCount == null) {
      checks.push({ status: 'warning', title: 'Item Specifics Not Verified', message: `Item specifics count is ${data && data.bulletPoints ? data.bulletPoints.status : STATUS.NOT_EXTRACTED}.`, solution: 'Manually review item specifics in the listing editor.' });
    } else if (bulletCount < 5) {
      checks.push({ status: 'warning', title: 'Limited Item Specifics Observed', message: `${bulletCount} item specific element(s) observed.`, solution: 'Review and complete relevant item specifics where appropriate.' });
      score -= 10;
    } else {
      checks.push({ status: 'success', title: 'Item Specifics Observed', message: `${bulletCount} item specific element(s) observed.`, solution: 'Keep item specifics accurate and up to date.' });
    }
  } else {
    if (bulletCount == null) {
      checks.push({ status: 'warning', title: 'Key Features Not Verified', message: `Bullet/key feature count is ${data && data.bulletPoints ? data.bulletPoints.status : STATUS.NOT_EXTRACTED}.`, solution: 'Manually confirm key features are clearly presented.' });
    } else if (bulletCount < 3) {
      checks.push({ status: 'warning', title: 'Few Key Features Observed', message: `${bulletCount} bullet/key feature item(s) observed.`, solution: 'Consider highlighting important product features clearly and accurately.' });
      score -= 10;
    } else {
      checks.push({ status: 'success', title: 'Key Features Observed', message: `${bulletCount} bullet/key feature item(s) observed.`, solution: 'Ensure feature statements are factual and consistent.' });
    }
  }

  if (reviewCount == null) {
    const rStatus = data && data.reviews ? data.reviews.status : STATUS.NOT_EXTRACTED;
    checks.push({ status: 'warning', title: 'Reviews Not Verified', message: `Product review count is ${rStatus} or not reliably attributable.`, solution: 'Manually verify product review data on the marketplace page.' });
  } else {
    checks.push({ status: 'success', title: 'Review Count Observed', message: `${reviewCount} review(s) observed (as extracted).`, solution: 'Use review insights cautiously and confirm details on the marketplace page.' });
  }

  score = Math.max(0, Math.min(100, score));
  return {
    score,
    scoreLabel: 'INTERNAL_HEURISTIC',
    title,
    price: data && data.price ? data.price : statusOnly(STATUS.NOT_EXTRACTED),
    marketplace,
    domain: data && data.domain ? data.domain : '',
    checks
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STATUS,
    observedValue,
    statusOnly,
    textStatus,
    parseNumberFromText,
    parseIntFromText,
    extractWalmartData,
    extractAmazonData,
    extractEbayData,
    extractTargetData,
    extractBestBuyData,
    analyzeListing,
    countWords
  };
}
