setup.SidebarUI = {
	update() {
		const sidebar = document.getElementById("custom-sidebar");
		const wasCollapsed = State.variables.sidebarCollapsed;

		if (!State.variables.player || !State.variables.world) {
			console.warn("SidebarUI: Player or World data missing.");
			return;
		}

		this.updateStatuses();
		this.updateCarryWeight();
		this.updateLevelAndExp();
		this.updateGold();
		this.updateTime();
		this.updateDate();
		this.updateWeather();
		this.updateSummaryIcons();

		// Reapply collapsed state after rendering
		if (wasCollapsed && sidebar) {
			sidebar.classList.add("collapsed");
			document.body.classList.add("sidebar-collapsed");

			const summary = document.getElementById("sidebar-summary");
			const content = document.getElementById("sidebar-content");
			if (summary) summary.style.display = "flex";
			if (content) content.style.display = "none";

			const toggleButton = document.getElementById("sidebar-toggle");
			if (toggleButton) {
				toggleButton.style.position = "initial";
			}
		}
	},


	updateStatuses() {
		const status = State.variables.player.status;

		const bars = [
			{ id: "health", value: status.health, max: status.maxHealth },
			{ id: "fatigue", value: status.fatigue, max: status.maxFatigue },
			{ id: "composure", value: status.composure, max: status.maxComposure },
			{ id: "excitement", value: status.excitement, max: status.maxExcitement }
		];

		bars.forEach(bar => {
			const fill = document.getElementById(`${bar.id}-fill`);
			if (fill) {
				const percent = (bar.value / bar.max) * 100;
				fill.style.width = `${percent}%`;

				if (percent >= 70) {
					fill.style.background = "linear-gradient(90deg, #4caf50, #81c784)";
				} else if (percent >= 30) {
					fill.style.background = "linear-gradient(90deg, #ff9800, #ffc107)";
				} else {
					fill.style.background = "linear-gradient(90deg, #f44336, #e57373)";
				}
			}
		});
	},

	updateCarryWeight() {
		const weight = State.variables.player.carryWeight;
		const carryContainer = document.getElementById("sidebar-carryweight");
		const carryFill = document.getElementById("carry-fill");
		const carryText = document.getElementById("carryweight-text");

		if (!weight || !carryContainer || !carryFill || !carryText) return;

		const percent = (weight.current / weight.max) * 100;

		if (percent >= 85) {
			carryContainer.style.display = "block";
			carryFill.style.width = `${percent}%`;
			carryText.textContent = `Carryweight: ${weight.current}/${weight.max}`;
		} else {
			carryContainer.style.display = "none";
		}
	},

	updateLevelAndExp() {
		const player = State.variables.player;
		const expPercent = (player.experience / player.experienceToNextLevel) * 100;

		const expFill = document.getElementById("exp-fill");
		const expText = document.getElementById("exp-text");
		const levelText = document.getElementById("sidebar-level");

		if (expFill) expFill.style.width = `${expPercent}%`;
		if (expText) expText.textContent = `${player.experience}/${player.experienceToNextLevel} XP`;
		if (levelText) levelText.textContent = `Lvl ${player.level}`;

		const miniFill = document.getElementById("exp-fill-mini");
		const miniLevel = document.getElementById("summary-level");
		if (miniFill) miniFill.style.width = `${expPercent}%`;
		if (miniLevel) miniLevel.textContent = `Lvl ${player.level}`;
	},

	updateTime() {
		const world = State.variables.world;
		if (!world) return;

		const hours = world.hour;
		const minutes = world.minute.toString().padStart(2, "0");
		let timeString = "";

		if (world.is24HourFormat) {
			timeString = `${hours}:${minutes}`;
		} else {
			const suffix = hours >= 12 ? "PM" : "AM";
			const hour12 = ((hours + 11) % 12 + 1);
			timeString = `${hour12}:${minutes} ${suffix}`;
		}

		const timeDisplay = document.getElementById("sidebar-time");
		const timeSummary = document.getElementById("summary-time");

		if (timeDisplay) timeDisplay.textContent = timeString;
		if (timeSummary) timeSummary.textContent = timeString;
	},

	updateDate() {
		const world = State.variables.world;
		if (!world) return;

		const seasons = ["Rain", "Sun", "Harvest", "Snow"];
		const seasonIndex = Math.floor((world.dayOfYear - 1) / 100);
		const seasonDay = ((world.dayOfYear - 1) % 100) + 1;
		const seasonName = seasons[seasonIndex] || "Unknown";

		const dateString = `${seasonDay} of ${seasonName}, ${world.year} AI`;

		const dateDisplay = document.getElementById("sidebar-date");
		if (dateDisplay) dateDisplay.textContent = dateString;
	},

	updateWeather() {
		const world = State.variables.world;
		const icon = document.getElementById("sidebar-weather-icon");

		if (!icon || !world) return;

		const weatherIcons = {
			"Clear": "sun",
			"Rain": "cloud-rain",
			"Storm": "cloud-lightning",
			"Snow": "snowflake",
			"Fog": "cloud-fog"
		};

		const weatherName = world.weather || "Clear";
		const iconName = weatherIcons[weatherName] || "sun";

		icon.setAttribute("data-lucide", iconName);
		icon.setAttribute("title", weatherName);

		if (window.lucide) {
			lucide.createIcons();
		}
	},

	updateSummaryIcons() {
		const status = State.variables.player.status;

		const icons = [
			{ id: "summary-health", fillId: "summary-health-fill", value: status.health, max: status.maxHealth },
			{ id: "summary-fatigue", fillId: "summary-fatigue-fill", value: status.fatigue, max: status.maxFatigue },
			{ id: "summary-composure", fillId: "summary-composure-fill", value: status.composure, max: status.maxComposure },
			{ id: "summary-excitement", fillId: "summary-excitement-fill", value: status.excitement, max: status.maxExcitement }
		];

		icons.forEach(icon => {
			const iconEl = document.getElementById(icon.id);
			const fillEl = document.getElementById(icon.fillId);
			const percent = Math.max(0, Math.min(100, (icon.value / icon.max) * 100));

			if (fillEl) {
				fillEl.style.height = `${percent}%`;
			}

			if (iconEl) {
				iconEl.classList.remove("low", "mid", "high");

				if (percent >= 70) {
					iconEl.classList.add("high");
					iconEl.style.filter = "drop-shadow(0 0 3px #4caf50cc)";
				} else if (percent >= 30) {
					iconEl.classList.add("mid");
					iconEl.style.filter = "drop-shadow(0 0 2px #ffc107cc)";
				} else {
					iconEl.classList.add("low");
					iconEl.style.filter = "drop-shadow(0 0 2px #f44336cc)";
				}
			}
		});
	},

	getGoldAmount() {
		const inventory = State.variables.inventory_player;
		if (!inventory) return 0;

		return inventory["gold_coin"] || 0;
	},


	updateGold() {
		const gold = this.getGoldAmount();
		const goldDisplay = document.getElementById("sidebar-gold-amount");
		const goldSummary = document.getElementById("summary-gold");

		const formattedGold = gold >= 1000 ? (gold / 1000).toFixed(1) + "K" : gold;

		if (goldDisplay) goldDisplay.textContent = formattedGold;
		if (goldSummary) goldSummary.textContent = formattedGold;
	},

	toggleSidebar() {
		const sidebar = document.getElementById("custom-sidebar");
		const arrow = document.getElementById("sidebar-arrow");
		const toggleButton = document.getElementById("sidebar-toggle");
		const summary = document.getElementById("sidebar-summary");
		const content = document.getElementById("sidebar-content");

		if (!sidebar || !summary || !content) {
			console.warn("[SidebarUI] Sidebar or required elements not found.");
			return;
		}

		sidebar.classList.toggle("collapsed");
		const isCollapsed = sidebar.classList.contains("collapsed");

		// SAVE collapsed state in State.variables
		State.variables.sidebarCollapsed = isCollapsed;

		document.body.classList.toggle("sidebar-collapsed", isCollapsed);

		if (arrow) {
			arrow.style.transform = isCollapsed ? "rotate(180deg)" : "rotate(0deg)";
		}

		if (toggleButton) {
			toggleButton.style.position = isCollapsed ? "initial" : "fixed";
		}

		summary.style.display = isCollapsed ? "flex" : "none";
		content.style.display = isCollapsed ? "none" : "block";

		this.update();
		console.log(`[SidebarUI] Sidebar is now ${isCollapsed ? "collapsed" : "expanded"}.`);
	},


	updateSidebar() {
		const player = State.variables.player;
		const world = State.variables.world;
		const inventory = State.variables.inventory_player || {};

		if (!player || !world) {
			console.warn("[SidebarUI] Player or WorldState missing — cannot update sidebar.");
			return;
		}

		this.updateText("sidebar-time", this.formatWorldTime(world.hour, world.minute, world.is24HourFormat));
		this.updateText("sidebar-date", this.formatWorldDate(world.dayOfYear, world.year));
		this.updateText("sidebar-location", world.locationName || "Unknown Location");

		this.updateWeatherIcon(world.weather);

		const goldAmount = this.getGoldAmount();
		this.updateText("sidebar-gold-amount", this.abbreviateGold(goldAmount));
		this.updateText("summary-gold", this.abbreviateGold(goldAmount));

		this.updateText("summary-level", `Lvl ${player.level}`);
		this.updateExpBars(player);
		this.updateStatusBars(player);

		this.updateStatusIcon("summary-health", player.status.health, player.status.maxHealth);
		this.updateStatusIcon("summary-fatigue", player.status.fatigue, player.status.maxFatigue, true);
		this.updateStatusIcon("summary-composure", player.status.composure, player.status.maxComposure);
		this.updateStatusIcon("summary-excitement", player.status.excitement, player.status.maxExcitement);

		this.updateConditionalStatusIcons(player.status);
	},

	updateText(id, text) {
		const el = document.getElementById(id);
		if (el) el.textContent = text;
	},

	updateWeatherIcon(weatherType) {
		const icon = document.getElementById("sidebar-weather-icon");
		if (!icon) return;

		const weatherIcons = {
			Clear: "sun",
			Rain: "cloud-rain",
			Storm: "cloud-lightning",
			Snow: "cloud-snow",
			Fog: "cloud-fog"
		};

		const iconName = weatherIcons[weatherType] || "sun";
		icon.setAttribute("data-lucide", iconName);

		if (window.lucide) {
			lucide.createIcons();
		}
	},

	abbreviateGold(amount) {
		if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1) + "M";
		if (amount >= 1_000) return (amount / 1_000).toFixed(1) + "K";
		return amount.toString();
	},

	updateExpBars(player) {
		const percent = Math.min((player.experience / player.experienceToNextLevel) * 100, 100);
		this.setFillWidth("exp-fill", percent);
		this.setFillWidth("exp-fill-mini", percent);
		this.updateText("exp-text", `${player.experience}/${player.experienceToNextLevel} XP`);
	},

	updateStatusBars(player) {
		this.setFillWidth("health-fill", (player.status.health / player.status.maxHealth) * 100);
		this.setFillWidth("fatigue-fill", (player.status.fatigue / player.status.maxFatigue) * 100);
		this.setFillWidth("composure-fill", (player.status.composure / player.status.maxComposure) * 100);
		this.setFillWidth("excitement-fill", (player.status.excitement / player.status.maxExcitement) * 100);
	},

	setFillWidth(id, percent) {
		const fill = document.getElementById(id);
		if (fill) {
			fill.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
		}
	},

	updateStatusIcon(iconId, current, max, inverse = false) {
		const icon = document.getElementById(iconId);
		if (!icon) return;

		const ratio = current / max;
		let color = "white";

		if (inverse) {
			color = ratio >= 0.75 ? "red" : ratio >= 0.5 ? "orange" : "green";
		} else {
			color = ratio <= 0.25 ? "red" : ratio <= 0.5 ? "orange" : "green";
		}

		icon.style.stroke = color;
	},

	updateConditionalStatusIcons(status) {
		const container = document.getElementById("summary-conditions");
		if (!container) return;

		container.innerHTML = "";

		const effects = [
			{ key: "poisoned", icon: "skull" },
			{ key: "intoxicated", icon: "glass-water" },
			{ key: "charmed", icon: "heart-handshake" },
			{ key: "burning", icon: "flame" },
			{ key: "bleeding", icon: "droplet" },
			{ key: "stunned", icon: "zap-off" }
		];

		effects.forEach(effect => {
			if (status[effect.key]) {
				const newIcon = document.createElement("i");
				newIcon.setAttribute("data-lucide", effect.icon);
				newIcon.style.width = "16px";
				newIcon.style.height = "16px";
				container.appendChild(newIcon);
			}
		});

		if (window.lucide) {
			lucide.createIcons();
		}
	},

	formatWorldTime(hour, minute, is24h) {
		if (is24h) {
			return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
		} else {
			const ampm = hour >= 12 ? "PM" : "AM";
			const h12 = hour % 12 || 12;
			return `${h12}:${minute.toString().padStart(2, "0")} ${ampm}`;
		}
	},

	formatWorldDate(dayOfYear, year) {
		const seasons = ["Rain", "Sun", "Harvest", "Snow"];
		const seasonLength = 100;
		const seasonIndex = Math.floor((dayOfYear - 1) / seasonLength);
		const seasonDay = ((dayOfYear - 1) % seasonLength) + 1;
		const season = seasons[seasonIndex] || "Unknown";
		return `${seasonDay} of ${season}, ${year} AI`;
	},

	tryLucideIcons() {
		if (typeof lucide !== "undefined") {
			lucide.createIcons();
			console.log("[SidebarUI] Lucide icons rendered successfully!");
		} else {
			console.warn("[SidebarUI] Lucide not ready yet — retrying in 250ms...");
			setTimeout(this.tryLucideIcons, 250);
		}
	}
};


/* Dedicated button handlers */
  
$(document).on("click", "#btn-saves", () => {
	if (typeof UI?.saves === "function") UI.saves();
});


$(document).on("click", "#sidebar-nav-back", () => {
	console.log("[SidebarUI] Back clicked — invoking Engine.backward()");
	Engine.backward();
});

$(document).on("click", "#sidebar-nav-forward", () => {
	console.log("[SidebarUI] Forward clicked — invoking Engine.forward()");
	Engine.forward();
});

$(document).on("click", "#sidebar-toggle", () => {
	if (typeof setup?.SidebarUI?.toggleSidebar === "function") {
		setup.SidebarUI.toggleSidebar();
	} else {
		console.warn("[SidebarUI] toggleSidebar() is not defined.");
	}
});

$(document).on("click", "#sidebar-options", () => {
	const UI = SugarCube?.UI;
	if (typeof UI?.settings === "function") {
		console.log("[SidebarUI] Opening Settings dialog.");
		UI.settings();
	} else {
		console.warn("[SidebarUI] SugarCube.UI.settings() not available.");
	}
});


/* Sidebar Updating with every click and passage change */
// Update sidebar on every passage load
$(document).on(":passagedisplay", () => {
	if (typeof setup?.SidebarUI?.update === "function") {
		setup.SidebarUI.update();
	}
});

// Throttled update on every click (avoids spamming)
let sidebarUpdateTimeout;
document.addEventListener("click", () => {
	clearTimeout(sidebarUpdateTimeout);
	sidebarUpdateTimeout = setTimeout(() => {
		if (typeof setup?.SidebarUI?.update === "function") {
			setup.SidebarUI.update();
		}
	}, 50);
});





