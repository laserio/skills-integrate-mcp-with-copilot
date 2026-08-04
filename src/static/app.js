document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const authToggle = document.getElementById("auth-toggle");
  const authPanel = document.getElementById("auth-panel");
  const loginForm = document.getElementById("login-form");
  const userBadge = document.getElementById("user-badge");
  const manageNote = document.getElementById("manage-note");

  let currentUser = null;

  function setMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function getAuthHeaders() {
    if (!currentUser?.token) {
      return {};
    }

    return {
      Authorization: `Bearer ${currentUser.token}`,
    };
  }

  function setManagementMode(enabled) {
    signupForm.classList.toggle("disabled", !enabled);
    const fields = signupForm.querySelectorAll("input, select, button[type='submit']");
    fields.forEach((field) => {
      field.disabled = !enabled;
    });

    manageNote.textContent = enabled
      ? `Signed in as ${currentUser.username} (${currentUser.role}). You can manage registrations.`
      : "Teachers and directors can sign in to manage activity registrations.";
  }

  function syncAuthUi() {
    const storedAuth = window.localStorage.getItem("school-auth");
    if (storedAuth) {
      currentUser = JSON.parse(storedAuth);
    } else {
      currentUser = null;
    }

    if (currentUser) {
      authToggle.textContent = "Logout";
      userBadge.textContent = `${currentUser.role} • ${currentUser.username}`;
      userBadge.classList.remove("hidden");
    } else {
      authToggle.textContent = "Login";
      userBadge.textContent = "";
      userBadge.classList.add("hidden");
    }

    authPanel.classList.add("hidden");
    setManagementMode(Boolean(currentUser && ["teacher", "director"].includes(currentUser.role)));
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;
        const canManage = Boolean(currentUser && ["teacher", "director"].includes(currentUser.role));

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map((email) => {
                    if (!canManage) {
                      return `<li><span class="participant-email">${email}</span></li>`;
                    }

                    return `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button></li>`;
                  })
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser || !["teacher", "director"].includes(currentUser.role)) {
      setMessage("Please sign in as a teacher or director to manage registrations.", "error");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        currentUser = {
          username: result.username,
          role: result.role,
          token: result.token,
        };
        window.localStorage.setItem("school-auth", JSON.stringify(currentUser));
        syncAuthUi();
        await fetchActivities();
        setMessage(`Signed in as ${result.username} (${result.role}).`, "success");
      } else {
        setMessage(result.detail || "Unable to sign in", "error");
      }
    } catch (error) {
      setMessage("Failed to sign in. Please try again.", "error");
      console.error("Error signing in:", error);
    }
  });

  authToggle.addEventListener("click", () => {
    if (currentUser) {
      window.localStorage.removeItem("school-auth");
      currentUser = null;
      syncAuthUi();
      fetchActivities();
      setMessage("You have been signed out.", "info");
      return;
    }

    authPanel.classList.toggle("hidden");
  });

  syncAuthUi();
  fetchActivities();
});
