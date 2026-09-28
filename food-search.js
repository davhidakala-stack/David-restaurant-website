const foodCatalog = [
    { name: "Swallow and Soup", price: "₦3,500", page: "menu2.html" },
    { name: "Ewa,MoiMoi and Egg", price: "₦4,000", page: "menu2.html" },
    { name: "Grilled Chicken", price: "₦2,500", page: "menu2.html" },
    { name: "Jollof rice", price: "₦3,000", page: "menu2.html" },
    { name: "Chunky Burger", price: "₦3,500", page: "burger1.html" },
    { name: "Grilled Burger with fries and coke", price: "₦4,000", page: "burger1.html" },
    { name: "Crunchy Size Burger", price: "₦6,500", page: "burger1.html" },
    { name: "Chongqing Chicken", price: "₦13,500", page: "asian.html" },
    { name: "Mapo Tofu Rice", price: "₦14,000", page: "asian.html" },
    { name: "Pad See Ew", price: "₦16,500", page: "asian.html" },
    { name: "italian spring roll", price: "₦6,500", page: "continental.html" },
    { name: "cookies with strawberries", price: "₦5,000", page: "continental.html" },
    { name: "Sweets", price: "₦6,500", page: "continental.html" }
];

const foodDescriptions = {
    "swallow and soup": "Pair soft, satisfying swallow with a hearty soup for a classic Nigerian comfort meal. Scoop, dip, and enjoy.",
    "ewa,moimoi and egg": "A comforting Nigerian trio of tender beans, steamed moi moi (savory bean pudding), and egg. Filling, familiar, and full of flavor.",
    "grilled chicken": "Enjoy savory grilled chicken with a gently smoky finish: a satisfying favorite for any meal.",
    "jollof rice": "A West African favorite: rice cooked with tomato, peppers, and warming spices for a rich, savory taste in every spoonful.",
    "chunky burger": "Bring your appetite for a generously sized burger made for a hearty, satisfying bite.",
    "grilled burger with fries and coke": "A grilled burger with fries and Coke brings the classic, satisfying meal together in one order.",
    "crunchy size burger": "A substantial burger with a satisfying crunch and a hearty bite from the first taste to the last.",
    "chongqing chicken": "Inspired by Chongqing-style cooking, this chicken is known for bold chili warmth and fragrant Sichuan pepper.",
    "mapo tofu rice": "A Sichuan-inspired favorite: tender tofu in a savory, chili-rich mapo sauce, served with rice.",
    "pad see ew": "Thai stir-fried rice noodles with savory soy flavor and lightly smoky edges for a deeply satisfying bowl.",
    "italian spring roll": "A crisp, golden spring roll with an Italian-inspired twist: a tempting start or a snack all on its own.",
    "cookies with strawberries": "Sweet cookies meet bright strawberry flavor in a fruity treat made for a little moment of indulgence.",
    "sweets": "Finish on a sweet note with a treat chosen to brighten your day and round out your order."
};

function createSearchResult(item) {
    const link = document.createElement("a");
    link.href = item.page;
    link.className = "search-result";

    const name = document.createElement("strong");
    name.textContent = item.name;
    const price = document.createElement("span");
    price.textContent = item.price;

    link.append(name, price);
    return link;
}

function setupFoodDescriptions() {
    document.querySelectorAll(".food-container .food-name").forEach((name) => {
        const descriptionText = foodDescriptions[name.textContent.trim().toLowerCase()];
        const imageWrapper = name.closest(".food-info")?.previousElementSibling;
        if (!descriptionText || !imageWrapper?.classList.contains("food-image-wrapper")) return;

        const description = document.createElement("p");
        description.className = "food-description";
        description.textContent = descriptionText;
        imageWrapper.appendChild(description);
    });
}

function updateFoodCards(query) {
    const normalizedQuery = query.trim().toLowerCase();
    const foodCards = document.querySelectorAll(
        ".food-container .food-card, .food-container .new-card"
    );

    foodCards.forEach((card) => {
        const name = card.querySelector(".food-name");
        if (!name) return;

        card.hidden = normalizedQuery !== "" &&
            !name.textContent.toLowerCase().includes(normalizedQuery);
    });
}

function updateSearchResults(input, results) {
    const query = input.value.trim().toLowerCase();
    results.innerHTML = "";
    updateFoodCards(query);

    if (!query) {
        results.hidden = true;
        return;
    }

    const matches = foodCatalog.filter((item) =>
        item.name.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
        const emptyResult = document.createElement("p");
        emptyResult.className = "search-empty";
        emptyResult.textContent = "No matching food found.";
        results.appendChild(emptyResult);
    } else {
        matches.forEach((item) => results.appendChild(createSearchResult(item)));
    }

    results.hidden = false;
}

function setupSiteFooter() {
    if (document.querySelector(".site-footer")) return;

    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
        <div class="site-footer-content">
            <div>
                <strong>David Restaurant</strong>
                <p>Food of Elegance</p>
            </div>
            <div class="site-footer-contact" aria-label="Contact details">
                <p><span>Phone</span> Add restaurant phone number</p>
                <p><span>Instagram</span> Add Instagram handle</p>
                <p><span>Facebook</span> Add Facebook page</p>
            </div>
            <p class="site-footer-copyright">&copy; 2026 David Restaurant. All rights reserved.</p>
        </div>`;
    document.body.append(footer);
}

function setupFoodSearch() {
    const search = document.createElement("section");
    search.className = "site-search";
    search.id = "food-search-panel";
    search.setAttribute("aria-label", "Search available food");
    search.innerHTML = `
        <form class="search-form" role="search">
            <label class="search-label" for="foodSearchInput">Search available food</label>
            <div class="search-controls">
                <input id="foodSearchInput" type="search" placeholder="Search burgers, rice, chicken..." autocomplete="off">
                <button type="submit">Search</button>
            </div>
            <div class="search-results" hidden></div>
        </form>`;

    const currentPage = window.location.pathname.split("/").pop();
    if (currentPage !== "menu.html" && currentPage !== "order.html" && currentPage !== "index.html") {
        const menuLink = document.createElement("a");
        menuLink.href = "menu.html";
        menuLink.className = "back-to-menu";
        menuLink.textContent = "← Back to Main Menu";

        const homeLink = document.createElement("a");
        homeLink.href = "index.html";
        homeLink.className = "back-to-home";
        homeLink.textContent = "← Back to Home";
        search.prepend(homeLink);
        homeLink.after(menuLink);
    }

    const header = document.querySelector("header");
    if (header) {
        header.insertAdjacentElement("afterend", search);
        search.classList.add("has-header");
    } else {
        document.body.prepend(search);
    }

    const form = search.querySelector(".search-form");
    const input = search.querySelector("#foodSearchInput");
    const results = search.querySelector(".search-results");
    const headerSearchButton = document.querySelector(".header-search-button");

    if (headerSearchButton) {
        headerSearchButton.addEventListener("click", () => {
            const isHomePage = document.body.classList.contains("home-page");
            if (isHomePage) {
                const isOpen = search.classList.toggle("is-open");
                if (isOpen) {
                    search.style.display = "block";
                    search.scrollIntoView({ behavior: "smooth", block: "start" });
                    input.focus();
                    input.select();
                } else {
                    search.style.display = "none";
                }
            } else {
                search.scrollIntoView({ behavior: "smooth", block: "start" });
                input.focus();
                input.select();
            }
        });
    }

    input.addEventListener("input", () => updateSearchResults(input, results));
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        updateSearchResults(input, results);
        const firstResult = results.querySelector(".search-result");
        if (firstResult) {
            firstResult.focus();
        }
    });

    setupFoodDescriptions();
    setupSiteFooter();
}

document.addEventListener("DOMContentLoaded", setupFoodSearch);
