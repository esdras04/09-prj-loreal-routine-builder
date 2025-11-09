/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectedBtn = document.getElementById("clearSelected");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");

/* Add your Cloudflare Worker URL here */
const CLOUDFLARE_WORKER_URL = "https://loreal-routine-worker.esdrasmora.workers.dev/";

/* Store selected products and conversation history */
let selectedProducts = [];
let conversationHistory = [];

/* Show initial placeholder */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load selected products from localStorage on page load */
function loadSelectedProducts() {
  const saved = localStorage.getItem("selectedProducts");
  if (saved) {
    try {
      selectedProducts = JSON.parse(saved);
      updateSelectedProductsDisplay();
    } catch (error) {
      console.error("Error loading saved products:", error);
      selectedProducts = [];
    }
  }
}

/* Save selected products to localStorage */
function saveSelectedProducts() {
  localStorage.setItem("selectedProducts", JSON.stringify(selectedProducts));
}

/* Load product data from JSON file */
async function loadProducts() {
  try {
    const response = await fetch("products.json");
    const data = await response.json();
    return data.products;
  } catch (error) {
    console.error("Error loading products:", error);
    return [];
  }
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found in this category
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some((p) => p.id.toString() === product.id.toString());
      return `
        <div class="product-card ${isSelected ? "selected" : ""}" data-product-id="${product.id}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p>${product.brand}</p>
          </div>
          <div class="selection-badge">
            <i class="fa-solid fa-check"></i>
          </div>
          <div class="product-description">
            <h4>${product.name}</h4>
            <p>${product.description || "No description available."}</p>
          </div>
        </div>
      `;
    })
    .join("");

  /* Add click handlers to product cards */
  document.querySelectorAll(".product-card").forEach((card) => {
    card.addEventListener("click", handleProductClick);
  });
}

/* Handle product card click to select or unselect */
async function handleProductClick(e) {
  const card = e.currentTarget;
  const productId = card.dataset.productId;
  
  const products = await loadProducts();
  const product = products.find((p) => p.id.toString() === productId.toString());

  if (!product) {
    console.error("Product not found:", productId);
    return;
  }

  const index = selectedProducts.findIndex((p) => p.id.toString() === productId.toString());

  if (index > -1) {
    /* Product is already selected so remove it */
    selectedProducts.splice(index, 1);
    card.classList.remove("selected");
  } else {
    /* Add product to selection */
    selectedProducts.push(product);
    card.classList.add("selected");
  }

  saveSelectedProducts();
  updateSelectedProductsDisplay();
}

/* Update the selected products display */
function updateSelectedProductsDisplay() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = "";
    selectedProductsList.classList.add("empty");
    generateRoutineBtn.disabled = true;
    clearSelectedBtn.disabled = true;
    return;
  }

  selectedProductsList.classList.remove("empty");
  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
    <div class="selected-item">
      <img src="${product.image}" alt="${product.name}" class="selected-item-image">
      <span>${product.name}</span>
      <button onclick="removeSelectedProduct('${product.id}')" title="Remove" aria-label="Remove ${product.name}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `
    )
    .join("");

  generateRoutineBtn.disabled = false;
  clearSelectedBtn.disabled = false;
}

/* Remove a single product from selection */
window.removeSelectedProduct = function (productId) {
  selectedProducts = selectedProducts.filter((p) => p.id.toString() !== productId.toString());
  saveSelectedProducts();
  updateSelectedProductsDisplay();

  /* Update the visual state of the product card if it is visible */
  const card = document.querySelector(`[data-product-id="${productId}"]`);
  if (card) {
    card.classList.remove("selected");
  }
};

/* Clear all selected products */
clearSelectedBtn.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  updateSelectedProductsDisplay();

  /* Remove selected class from all cards */
  document.querySelectorAll(".product-card").forEach((card) => {
    card.classList.remove("selected");
  });
});

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Add message to chat window */
function addMessageToChat(message, type) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `chat-message ${type}`;
  
  /* Format assistant messages with better spacing */
  if (type === "assistant") {
    /* Replace numbered lists with proper formatting */
    let formattedMessage = message
      .replace(/(\d+\.\s)/g, '\n$1')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .trim();
    
    messageDiv.innerHTML = formattedMessage;
  } else {
    messageDiv.textContent = message;
  }
  
  chatWindow.appendChild(messageDiv);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Generate routine when button is clicked */
generateRoutineBtn.addEventListener("click", async () => {
  if (selectedProducts.length === 0) return;

  /* Disable button and input while processing */
  generateRoutineBtn.disabled = true;
  sendBtn.disabled = true;

  /* Build the prompt with selected products */
  const productNames = selectedProducts.map((p) => p.name).join(", ");
  const systemMessage = `You are a helpful beauty advisor for L'Oréal. You ONLY discuss L'Oréal products, skincare, haircare, makeup, and beauty topics. If asked about anything unrelated to cosmetics or beauty (like coding, math, general knowledge, etc.), politely redirect the conversation back to beauty and L'Oréal products.

Create a personalized skincare/beauty routine using these selected L'Oréal products: ${productNames}. Provide step-by-step instructions and explain why each product should be used in that order. within the max token limit.`;

  /* Add user request to chat */
  addMessageToChat(
    "Please create a routine with my selected products.",
    "user"
  );

  try {
    /* Call OpenAI API through Cloudflare Worker */
    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemMessage },
          {
            role: "user",
            content: "Create a routine with these products.",
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate routine");
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    /* Add assistant response to chat */
    addMessageToChat(assistantMessage, "assistant");

    /* Update conversation history */
    conversationHistory = [
      { role: "system", content: systemMessage },
      { role: "user", content: "Create a routine with these products." },
      { role: "assistant", content: assistantMessage },
    ];
  } catch (error) {
    console.error("Error generating routine:", error);
    addMessageToChat(
      "Sorry, I encountered an error generating your routine. Please make sure your Cloudflare Worker URL is configured correctly.",
      "system"
    );
  } finally {
    /* Re-enable button and input */
    generateRoutineBtn.disabled = false;
    sendBtn.disabled = false;
  }
});

/* Handle chat form submission for follow-up questions */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  /* Disable input while processing */
  sendBtn.disabled = true;
  userInput.disabled = true;

  /* Add user message to chat */
  addMessageToChat(message, "user");
  userInput.value = "";

  try {
    /* Ensure the system message is in the conversation history */
    if (conversationHistory.length === 0 || conversationHistory[0].role !== "system") {
      const productNames = selectedProducts.map((p) => p.name).join(", ") || "L'Oréal products";
      const systemMessage = `You are a helpful beauty advisor for L'Oréal. You ONLY discuss L'Oréal products, skincare, haircare, makeup, and beauty topics. If asked about anything unrelated to cosmetics or beauty (like coding, math, general knowledge, etc.), politely redirect the conversation back to beauty and L'Oréal products. The user has selected these products: ${productNames}.`;
      conversationHistory.unshift({ role: "system", content: systemMessage });
    }

    /* Build messages array with conversation history */
    const messages = [
      ...conversationHistory,
      { role: "user", content: message },
    ];

    /* Call OpenAI API through Cloudflare Worker */
    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      throw new Error("Failed to get response");
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    /* Add assistant response to chat */
    addMessageToChat(assistantMessage, "assistant");

    /* Update conversation history */
    conversationHistory.push({ role: "user", content: message });
    conversationHistory.push({ role: "assistant", content: assistantMessage });
  } catch (error) {
    console.error("Error getting response:", error);
    addMessageToChat(
      "Sorry, I encountered an error. Please make sure your Cloudflare Worker URL is configured correctly.",
      "system"
    );
  } finally {
    /* Re-enable input */
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
});

/* Initialize on page load */
loadSelectedProducts();