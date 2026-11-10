(function (global) {
  const STATUS = {
    OBSERVED: 'OBSERVED',
    NOT_EXTRACTED: 'NOT_EXTRACTED',
    UNAVAILABLE: 'UNAVAILABLE',
    NOT_APPLICABLE: 'NOT_APPLICABLE'
  };

  const MARKETPLACE_FEES = {
    Amazon: { label: 'Amazon', supported: false },
    Walmart: { label: 'Walmart', supported: false },
    eBay: { label: 'eBay', supported: false },
    Target: { label: 'Target', supported: false },
    BestBuy: { label: 'BestBuy', supported: false }
  };

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

    // Title
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

    // Images
    if (imageCount == null) {
      checks.push({ status: 'warning', title: 'Image Count Unavailable', message: 'Image count could not be verified from the page. (NOT_EXTRACTED)', solution: 'Manually confirm the number and quality of listing images in the marketplace editor.' });
    } else if (imageCount < 4) {
      checks.push({ status: 'warning', title: 'Limited Images Observed', message: `${imageCount} image(s) observed. More images may help buyers, depending on marketplace requirements.`, solution: 'Review marketplace image guidelines and add additional clear, high-quality images if available.' });
      score -= 15;
    } else {
      checks.push({ status: 'success', title: 'Multiple Images Observed', message: `${imageCount} image(s) observed.`, solution: 'Confirm images meet marketplace quality and content guidelines.' });
    }

    // Description
    if (descStatus === STATUS.NOT_EXTRACTED || descStatus === STATUS.UNAVAILABLE) {
      checks.push({ status: 'warning', title: 'Description Not Verified', message: `Description content is ${descStatus}. It may be present but not accessible to this extractor.`, solution: 'Manually review the listing description in the marketplace editor for completeness and clarity.' });
    } else if (descWords < 50) {
      checks.push({ status: 'warning', title: 'Short Description Observed', message: `Description has ${descWords} observed word(s).`, solution: 'Consider adding clear product details, materials, dimensions, and use cases where relevant.' });
      score -= 10;
    } else {
      checks.push({ status: 'success', title: 'Description Observed', message: `Description has ${descWords} observed word(s).`, solution: 'Ensure information is accurate and consistent with the product.' });
    }

    // Bullets / specifics
    if (marketplace === 'eBay') {
      if (bulletCount == null) {
        checks.push({ status: 'warning', title: 'Item Specifics Not Verified', message: 'Item specifics count is NOT_EXTRACTED.', solution: 'Manually review item specifics in eBay Seller Hub.' });
      } else if (bulletCount < 5) {
        checks.push({ status: 'warning', title: 'Limited Item Specifics Observed', message: `${bulletCount} item specific element(s) observed.`, solution: 'Review and complete relevant item specifics in the listing editor.' });
        score -= 10;
      } else {
        checks.push({ status: 'success', title: 'Item Specifics Observed', message: `${bulletCount} item specific element(s) observed.`, solution: 'Keep item specifics accurate and up to date.' });
      }
    } else {
      if (bulletCount == null) {
        checks.push({ status: 'warning', title: 'Bullet Points Not Verified', message: 'Bullet/key feature count is NOT_EXTRACTED.', solution: 'Manually confirm key features are clearly presented.' });
      } else if (bulletCount < 3) {
        checks.push({ status: 'warning', title: 'Few Key Features Observed', message: `${bulletCount} bullet/key feature item(s) observed.`, solution: 'Consider highlighting important product features clearly and accurately.' });
        score -= 10;
      } else {
        checks.push({ status: 'success', title: 'Key Features Observed', message: `${bulletCount} bullet/key feature item(s) observed.`, solution: 'Ensure feature statements are factual and consistent.' });
      }
    }

    // Reviews - only if observed as product reviews; otherwise no penalty
    if (reviewCount == null) {
      checks.push({ status: 'warning', title: 'Reviews Not Verified', message: 'Product review count is NOT_EXTRACTED or not reliably attributable.', solution: 'Manually verify product review data on the marketplace page.' });
    } else {
      checks.push({ status: 'success', title: 'Review Count Observed', message: `${reviewCount} review(s) observed (as extracted).`, solution: 'Use review insights cautiously and confirm details on the marketplace page.' });
    }

    score = Math.max(0, Math.min(100, score));
    return {
      score,
      scoreLabel: 'INTERNAL_HEURISTIC',
      title,
      price: data && data.price ? data.price : { status: STATUS.NOT_EXTRACTED, value: null },
      marketplace,
      domain: data && data.domain ? data.domain : '',
      checks
    };
  }

  function getPricingStatus(inputs) {
    const hasCost = typeof inputs.cost === 'number' && isFinite(inputs.cost) && inputs.cost > 0;
    const hasFee = typeof inputs.feePercent === 'number' && isFinite(inputs.feePercent) && inputs.feePercent >= 0 && inputs.feePercent < 100;
    const hasMargin = typeof inputs.targetMarginPercent === 'number' && isFinite(inputs.targetMarginPercent);
    if (!hasCost || !hasFee || !hasMargin) {
      return { ok: false, status: 'INCOMPLETE', message: 'Pricing unavailable: enter cost, a custom fee %, and target margin assumptions.' };
    }
    const feeRate = inputs.feePercent / 100;
    const marginRate = inputs.targetMarginPercent / 100;
    const denom = 1 - feeRate - marginRate;
    if (denom <= 0) {
      return { ok: false, status: 'UNAVAILABLE', message: 'Pricing unavailable: fee and margin assumptions leave no room for a valid price.' };
    }
    const suggested = inputs.cost / denom;
    const feeAmount = suggested * feeRate;
    const profit = suggested - inputs.cost - feeAmount;
    return {
      ok: true,
      status: 'CUSTOM_SCENARIO',
      suggestedPrice: suggested,
      estimatedFee: feeAmount,
      estimatedProfit: profit,
      marginPercent: (profit / suggested) * 100
    };
  }

  function normalizeKeywordSuggestions(rawKeywords) {
    const arr = Array.isArray(rawKeywords) ? rawKeywords : [];
    const seen = new Set();
    const out = [];
    arr.forEach((k) => {
      const v = String(k || '').trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(v);
    });
    return out.map((keyword) => ({ keyword, source: 'autocomplete_suggestion', status: 'SUGGESTION_ONLY' }));
  }

  const api = { STATUS, MARKETPLACE_FEES, analyzeListing, getPricingStatus, normalizeKeywordSuggestions, countWords };
  global.FlexloopAnalyzer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
