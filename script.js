// Menu data mapping for categories
const menuData = {
    african: {
        title: "African Delicacies",
        description: "Immerse your senses in traditional tastes cooked with authentic local spices.",
        items: [
            { name: "Special Jollof Rice & Crispy Chicken", price: "₦5,500" },
            { name: "Pounded Yam & Egusi Soup", price: "₦6,000" },
            { name: "Ofada Rice & Spicy Sauce", price: "₦6,300" },
            { name: "Yamarita and Peppered Fish Sauce", price: "₦5,300" }
        ]
    },
    fastfood: {
        title: "Fast Food & Grills",
        description: "Juicy, filling options crafted for quick satisfaction and big flavor.",
        items: [
            { name: "Classic Beef Burger with Chips", price: "₦4,500" },
            { name: "Double Chicken Cheese Burger", price: "₦5,800" },
            { name: "Crispy Fried Chicken Wings (6pcs)", price: "₦4,000" },
            { name: "Loaded French Fries", price: "₦3,000" }
        ]
    },
    continental: {
        title: "Continental & Pastries",
        description: "A trip around international flavors combined with baked delights.",
        items: [
            { name: "Creamy Alfredo Pasta", price: "₦7,000" },
            { name: "Chicken Stir-fry with Fried Rice", price: "₦6,500" },
            { name: "Fresh Fruit Parfait", price: "₦4,300" },
            { name: "Chocolate Fudge Pastry Slice", price: "₦2,500" }
        ]
    }
};

function showMenu(categoryKey) {
    const container = document.getElementById('menuDisplayContainer');
    const titleElem = document.getElementById('menuTitle');
    const descElem = document.getElementById('menuDescription');
    const gridElem = document.getElementById('menuItemsGrid');

    const selectedCategory = menuData[categoryKey];

    // Populate content
    titleElem.innerText = selectedCategory.title;
    descElem.innerText = selectedCategory.description;
    
    gridElem.innerHTML = "";
    selectedCategory.items.forEach(item => {
        gridElem.innerHTML += `
            <div class="menu-item">
                <div class="menu-item-details">
                    <h4>${item.name}</h4>
                    <span>${item.price}</span>
                </div>
            </div>
        `;
    });

    // Make container visible and scroll smoothly to it
    container.classList.add('active');
    container.scrollIntoView({ behavior: 'smooth' });
}