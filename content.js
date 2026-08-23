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
      const analysis = analyzeListing(data, marketplace);
      sendResponse(analysis);
    } else {
      sendResponse({ error: "Unsupported marketplace." });
    }
  }
  return true; 
});

function extractWalmartData() {
  let title = document.querySelector('h1')?.innerText.trim() || '';
  let price = document.querySelector('span[itemprop="price"]')?.innerText.trim() || '';
  
  let imageCount = document.querySelectorAll('button[data-testid="item-page-image-thumbnail"]').length;
  if (imageCount === 0) imageCount = document.querySelectorAll('img[data-testid="hero-image"]').length || 1;

  const aboutSection = document.querySelector('section[data-testid="product-description"]') || document.querySelector('.about-item') || document.querySelector('.product-description');
  let descriptionText = aboutSection?.innerText.trim() || document.querySelector('.dangerous-html')?.innerText.trim() || '';
  let bulletCount = aboutSection ? aboutSection.querySelectorAll('li').length : 0;

  let reviewCountText = document.querySelector('a[data-testid="item-review-section-link"]')?.innerText.trim() || '0';
  let reviewCount = parseInt(reviewCountText.replace(/[^0-9]/g, '')) || 0;

  return { title, price, imageCount, descriptionText, bulletCount, reviewCount };
}

function extractAmazonData() {
  let title = document.getElementById('productTitle')?.innerText.trim() || '';
  let price = document.querySelector('.a-price .a-offscreen')?.innerText.trim() || 
              document.querySelector('#corePriceDisplay_desktop_feature_div .a-price-whole')?.innerText.trim() || '';
  
  // Amazon uses an altImages list
  let imageCount = document.querySelectorAll('#altImages li.item').length || 1;
  
  let descriptionText = document.getElementById('productDescription')?.innerText.trim() || '';
  let bulletCount = document.querySelectorAll('#feature-bullets li span.a-list-item').length;
  
  let rating = document.querySelector('#acrPopover')?.getAttribute('title') || '';
  let reviewCountText = document.querySelector('#acrCustomerReviewText')?.innerText.trim() || '0';
  let reviewCount = parseInt(reviewCountText.replace(/[^0-9]/g, '')) || 0;

  return { title, price, imageCount, descriptionText, bulletCount, rating, reviewCount };
}

function extractEbayData() {
  let title = document.querySelector('.x-item-title__mainTitle')?.innerText.trim() || '';
  let price = document.querySelector('.x-price-primary .ux-textspans')?.innerText.trim() || '';
  
  // eBay image carousel
  let imageCount = document.querySelectorAll('.ux-image-carousel-item img').length || 1;
  
  // eBay descriptions are often in iframes. For now, we capture what we can from the item specifics.
  let descriptionText = document.querySelector('.x-item-specifics')?.innerText.trim() || '';
  let bulletCount = document.querySelectorAll('.x-item-specifics ul li').length;

  let reviewCountText = document.querySelector('.x-sellercard-atf__about-seller span')?.innerText.trim() || '0';
  let reviewCount = parseInt(reviewCountText.replace(/[^0-9]/g, '')) || 0;

  return { title, price, imageCount, descriptionText, bulletCount, reviewCount };
}

function extractTargetData() {
  let title = document.querySelector('h1[data-test="product-title"]')?.innerText.trim() || document.querySelector('h1')?.innerText.trim() || '';
  let price = document.querySelector('[data-test="product-price"]')?.innerText.trim() || '';
  
  let imageCount = document.querySelectorAll('[data-test="image-gallery-thumbnail"]').length || 1;
  
  let descriptionText = document.querySelector('#product-details-tabs')?.innerText.trim() || document.querySelector('[data-test="item-details-description"]')?.innerText.trim() || '';
  let bulletCount = document.querySelectorAll('[data-test="item-details-specifications"] li').length || 0;
  
  let reviewCountText = document.querySelector('[data-test="ratings-reviews"] span')?.innerText.trim() || '0';
  let reviewCount = parseInt(reviewCountText.replace(/[^0-9]/g, '')) || 0;

  return { title, price, imageCount, descriptionText, bulletCount, reviewCount };
}

function extractBestBuyData() {
  let title = document.querySelector('.sku-title h1')?.innerText.trim() || document.querySelector('h1')?.innerText.trim() || '';
  let price = document.querySelector('.priceView-hero-price.priceView-customer-price span')?.innerText.trim() || '';
  
  let imageCount = document.querySelectorAll('.thumbnail-list .media-thumbnail').length || 1;
  
  let descriptionText = document.querySelector('.html-container')?.innerText.trim() || document.querySelector('.features-list')?.innerText.trim() || '';
  let bulletCount = document.querySelectorAll('.features-list .feature-item').length || 0;
  
  let reviewCountText = document.querySelector('.ugc-c-review-average .c-reviews-v4')?.innerText.trim() || '0';
  let reviewCount = parseInt(reviewCountText.replace(/[^0-9]/g, '')) || 0;

  return { title, price, imageCount, descriptionText, bulletCount, reviewCount };
}

function analyzeListing(data, marketplace) {
  const checks = [];
  let score = 100;

  const title = data.title;
  const imageCount = data.imageCount;
  const descriptionWordCount = data.descriptionText.split(/\s+/).filter(word => word.length > 0).length;
  const bulletCount = data.bulletCount;

  // Rule 1: Title Length
  if (!title) {
    checks.push({ status: 'error', title: 'Missing Title', message: 'Could not find product title.', solution: 'Write a title using the proven SEO formula: [Brand] + [Core Product Name] + [Top Feature] + [Size/Color/Specs]. Example: "Nike Men\'s Running Shoes, Lightweight Breathable, Black, Size 10".' });
    score -= 25;
  } else if (title.length < 50) {
    checks.push({ status: 'warning', title: 'Title too short', message: `Your title is ${title.length} characters. Best practice is 50-75 characters.`, solution: 'Your title is wasting valuable search space. Go to the "Keywords" tab, find 2 keywords with high search volume, and naturally insert them into the front of your title.' });
    score -= 10;
  } else if (title.length > 150) {
    checks.push({ status: 'warning', title: 'Title too long', message: `Your title is ${title.length} characters. Try keeping it concise (under 150 chars).`, solution: 'Keyword stuffing harms conversion rates. Remove repetitive words. Keep the first 50 characters focused on exactly what the product is for mobile shoppers.' });
    score -= 5;
  } else {
    checks.push({ status: 'success', title: 'Great Title Length', message: `Title is ${title.length} characters long, which is optimal.`, solution: 'To maintain your ranking, check the "Keywords" tab monthly and swap out any low-performing terms with trending search queries.' });
  }

  // Rule 2: Image Count
  if (imageCount < 4) {
    checks.push({ status: 'error', title: 'Add More Images', message: `You have ${imageCount} image(s). Marketplaces recommend at least 4 high-resolution images.`, solution: `Upload ${4 - imageCount} more images. Add 1 main white-background image, 2 lifestyle images showing the product in use, and 1 infographic explaining dimensions or key benefits.` });
    score -= 20;
  } else {
    checks.push({ status: 'success', title: 'Good Image Count', message: `You have ${imageCount} images, which meets the recommended minimum.`, solution: 'To crush competitors, add a short 15-second product video or a 360-degree interactive view. Listings with videos convert up to 80% higher.' });
  }

  // Rule 3: Description Word Count (eBay has special handling due to iframes)
  if (marketplace === "eBay" && descriptionWordCount < 20) {
    checks.push({ status: 'warning', title: 'Description Check', message: `Unable to fully scan eBay description due to custom HTML frames.`, solution: 'Make sure your eBay description is mobile-friendly. Avoid massive images in the description, use clear headings, and keep paragraphs under 3 sentences.' });
  } else {
    if (descriptionWordCount < 50) {
      checks.push({ status: 'error', title: 'Description Too Short', message: `Your description is only ${descriptionWordCount} words. Aim for at least 150 words.`, solution: 'Use the "AI Prompt" tab to instantly generate an optimized prompt for ChatGPT. Make sure it includes your target keywords from the Keywords tab.' });
      score -= 20;
    } else if (descriptionWordCount < 150) {
      checks.push({ status: 'warning', title: 'Expand Description', message: `Your description is ${descriptionWordCount} words. Try reaching 150 words for better SEO.`, solution: 'Add an FAQ section at the bottom answering the top 3 questions buyers have. Also, explicitly list the materials, dimensions, and warranty terms.' });
      score -= 10;
    } else {
      checks.push({ status: 'success', title: 'Detailed Description', message: `Your description has ${descriptionWordCount} words. Good job!`, solution: 'Use bolding (<b> tags) for key phrases so skimming buyers can easily read the benefits.' });
    }
  }

  // Rule 4: Bullet Points
  if (marketplace === "eBay") {
    // eBay relies heavily on Item Specifics, less on traditional bullets.
    if (bulletCount < 5) {
      checks.push({ status: 'warning', title: 'Item Specifics', message: `You only filled out ${bulletCount} item specifics.`, solution: 'Go to your eBay listing editor and fill out EVERY recommended item specific. This is how eBay filters search results; missing specifics means missing sales.' });
      score -= 10;
    } else {
      checks.push({ status: 'success', title: 'Item Specifics Good', message: `You filled out ${bulletCount} item specifics.`, solution: 'Periodically check your listing on the seller hub. eBay frequently adds new "Required" item specifics that can delist your item if ignored.' });
    }
  } else {
    if (bulletCount < 3) {
      checks.push({ status: 'warning', title: 'Add Bullet Points', message: `You only have ${bulletCount} bullet points. Use 3-10 key features.`, solution: 'Shoppers don\'t read, they skim. Add 3-5 bullet points at the top. Focus on BENEFITS, not just features (e.g. "Saves you 2 hours a day" instead of "Fast motor").' });
      score -= 15;
    } else if (bulletCount > 10) {
      checks.push({ status: 'warning', title: 'Too Many Bullets', message: `You have ${bulletCount} bullet points. Keep it under 10.`, solution: 'Consolidate redundant points. Too much text overwhelms mobile users. Stick to the top 5 most important features.' });
      score -= 5;
    } else {
      checks.push({ status: 'success', title: 'Optimal Key Features', message: `You have ${bulletCount} bullet points highlighting key features.`, solution: 'Start every bullet point with 2-3 capitalized words summarizing the feature (e.g., "100% WATERPROOF: You can submerge it...").' });
    }
  }

  // Rule 5: Review Count
  const reviewCount = data.reviewCount || 0;
  if (reviewCount < 10) {
    checks.push({ status: 'warning', title: 'Low Reviews', message: `You only have ${reviewCount} review(s).`, solution: 'Focus on gathering more reviews through post-purchase email campaigns or marketplace early-reviewer programs.' });
    score -= 5;
  } else if (reviewCount > 100) {
    checks.push({ status: 'success', title: 'Strong Social Proof', message: `You have ${reviewCount} reviews.`, solution: 'Great job! Consider highlighting customer testimonials in your A+ content or image carousel.' });
  } else {
    checks.push({ status: 'success', title: 'Good Social Proof', message: `You have ${reviewCount} reviews.`, solution: 'Keep encouraging customers to leave reviews.' });
  }

  score = Math.max(0, score);

  return {
    score: score,
    title: title,
    price: data.price,
    marketplace: marketplace,
    domain: window.location.hostname,
    checks: checks
  };
}
