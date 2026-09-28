const staffLogin = document.getElementById("staffLogin");
const staffStatus = document.getElementById("staffStatus");
const staffRequests = document.getElementById("staffRequests");

staffLogin.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = document.getElementById("adminToken").value;
    staffStatus.textContent = "Loading requests...";
    staffRequests.replaceChildren();

    try {
        const response = await fetch("/api/admin/requests", {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load requests.");

        if (data.requests.length === 0) {
            staffStatus.textContent = "No requests yet.";
            return;
        }

        data.requests.forEach((request) => {
            const article = document.createElement("article");
            article.className = "staff-request";
            const heading = document.createElement("h2");
            heading.textContent = `${request.kind === "refund" ? "Refund request" : "Customer-care request"} · ${request.ticketId}`;
            const contact = document.createElement("p");
            contact.textContent = `From ${request.email} · ${new Date(request.createdAt).toLocaleString()}`;
            const status = document.createElement("p");
            status.textContent = `Status: ${request.status}`;
            const message = document.createElement("p");
            message.textContent = request.message;
            article.append(heading, contact, status, message);
            staffRequests.appendChild(article);
        });
        staffStatus.textContent = `${data.requests.length} request(s) loaded.`;
    } catch (error) {
        staffStatus.textContent = error.message;
    }
});