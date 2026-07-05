(function () {
    "use strict";

    var STORAGE_KEY = "neurodirect_members_v1";
    var DATE_KEY = "neurodirect_last_day_v1";
    var members = [];
    var currentMemberId = null;

    function byId(id) {
        return document.getElementById(id);
    }

    function showError(message) {
        var box = byId("errorBox");
        if (!box) return;
        box.style.display = "block";
        box.textContent = "App error: " + message;
    }

    function hideError() {
        var box = byId("errorBox");
        if (!box) return;
        box.style.display = "none";
        box.textContent = "";
    }

    function twoDigits(value) {
        value = String(value);
        return value.length === 1 ? "0" + value : value;
    }

    function todayKey() {
        var now = new Date();
        return now.getFullYear() + "-" + twoDigits(now.getMonth() + 1) + "-" + twoDigits(now.getDate());
    }

    function formatDate(dateKey) {
        if (!dateKey) return "Unknown";
        var parts = String(dateKey).split("-");
        if (parts.length !== 3) return dateKey;

        var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return date.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "2-digit",
            month: "short"
        });
    }

    function formatNumber(value) {
        var num = Number(value || 0);
        return num.toLocaleString("en-GB");
    }

    function createId() {
        return "member_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    }

    function getInitials(name) {
        var clean = String(name || "").trim();
        if (!clean) return "?";
        var parts = clean.split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }

    function getPercent(member) {
        var steps = Number(member.todaySteps || 0);
        var goal = Number(member.dailyGoal || 0);
        if (goal <= 0) return 0;
        return Math.min(100, Math.round((steps / goal) * 100));
    }

    function clearElement(element) {
        if (!element) return;
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function div(className, text) {
        var element = document.createElement("div");
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function normaliseRole(role) {
        if (role === "Kid") return "Kid";
        if (role === "Teen") return "Teen";
        return "Parent";
    }

    function normaliseMember(member) {
        var history = [];
        var i;

        if (member && Object.prototype.toString.call(member.history) === "[object Array]") {
            for (i = 0; i < member.history.length && i < 7; i++) {
                if (member.history[i] && member.history[i].date) {
                    history.push({
                        date: String(member.history[i].date),
                        steps: Math.max(0, Number(member.history[i].steps || 0))
                    });
                }
            }
        }

        return {
            id: String(member && member.id ? member.id : createId()),
            name: String(member && member.name ? member.name : "Unnamed"),
            role: normaliseRole(member && member.role),
            dailyGoal: Math.max(1, Number(member && member.dailyGoal ? member.dailyGoal : 6000)),
            todaySteps: Math.max(0, Number(member && member.todaySteps ? member.todaySteps : 0)),
            history: history
        };
    }

    function loadMembers() {
        var raw;
        var parsed;
        var i;

        try {
            raw = localStorage.getItem(STORAGE_KEY);
            parsed = raw ? JSON.parse(raw) : [];

            if (Object.prototype.toString.call(parsed) !== "[object Array]") {
                members = [];
                return;
            }

            members = [];
            for (i = 0; i < parsed.length; i++) {
                members.push(normaliseMember(parsed[i]));
            }
        } catch (error) {
            members = [];
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (ignore) {}
            showError("Saved data was damaged, so it has been reset.");
        }
    }

    function saveMembers() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(members));
        } catch (error) {
            showError("Could not save data on this device.");
        }
    }

    function rolloverCheck() {
        var today = todayKey();
        var lastDay;
        var i;
        var member;

        try {
            lastDay = localStorage.getItem(DATE_KEY);
        } catch (error) {
            return;
        }

        if (!lastDay) {
            localStorage.setItem(DATE_KEY, today);
            saveMembers();
            return;
        }

        if (lastDay === today) {
            saveMembers();
            return;
        }

        for (i = 0; i < members.length; i++) {
            member = members[i];
            if (Object.prototype.toString.call(member.history) !== "[object Array]") {
                member.history = [];
            }

            member.history.unshift({
                date: lastDay,
                steps: Number(member.todaySteps || 0)
            });

            member.history = member.history.slice(0, 7);
            member.todaySteps = 0;
        }

        localStorage.setItem(DATE_KEY, today);
        saveMembers();
    }

    function showScreen(screenId) {
        var screens = document.querySelectorAll(".screen");
        var i;
        var screen;

        for (i = 0; i < screens.length; i++) {
            screens[i].className = "screen";
        }

        screen = byId(screenId);
        if (screen) screen.className = "screen active";
    }

    function getCurrentMember() {
        var i;
        for (i = 0; i < members.length; i++) {
            if (members[i].id === currentMemberId) return members[i];
        }
        return null;
    }

    function totalStepsToday() {
        var total = 0;
        var i;
        for (i = 0; i < members.length; i++) {
            total += Number(members[i].todaySteps || 0);
        }
        return total;
    }

    function goHome() {
        currentMemberId = null;
        renderHome();
        showScreen("homeScreen");
    }

    function renderHome() {
        hideError();
        byId("totalStepsText").textContent = formatNumber(totalStepsToday());
        renderLeaderboard();
        renderMemberList();
    }

    function renderLeaderboard() {
        var board = byId("leaderboard");
        var title;
        var sorted;
        var i;
        var member;
        var row;
        var rank;
        var main;
        var name;
        var steps;

        clearElement(board);
        title = div("section-title", "Leaderboard");
        board.appendChild(title);

        if (members.length === 0) {
            board.appendChild(div("empty-state", "No leaderboard yet. Add a member to get started."));
            return;
        }

        sorted = members.slice().sort(function (a, b) {
            return Number(b.todaySteps || 0) - Number(a.todaySteps || 0);
        });

        for (i = 0; i < sorted.length; i++) {
            member = sorted[i];
            row = div("leaderboard-item");
            rank = div("rank", String(i + 1));
            main = div("leaderboard-main");
            name = div("leaderboard-name", member.name);
            steps = div("leaderboard-steps", formatNumber(member.todaySteps) + " steps today");

            main.appendChild(name);
            main.appendChild(steps);
            row.appendChild(rank);
            row.appendChild(main);
            board.appendChild(row);
        }
    }

    function renderMemberList() {
        var list = byId("memberList");
        var i;
        var member;
        var percent;
        var row;
        var avatar;
        var info;
        var name;
        var role;
        var steps;
        var progress;
        var fill;
        var chevron;

        clearElement(list);

        if (members.length === 0) {
            list.appendChild(div("empty-state", "No members yet. Add your first family member."));
            return;
        }

        for (i = 0; i < members.length; i++) {
            member = members[i];
            percent = getPercent(member);

            row = div("member");
            row.setAttribute("data-id", member.id);

            avatar = div("member-avatar", getInitials(member.name));
            info = div("member-info");
            name = div("member-name", member.name);
            role = div("member-role", member.role);
            steps = div("member-steps", formatNumber(member.todaySteps) + " / " + formatNumber(member.dailyGoal) + " steps (" + percent + "%)");

            progress = div("progress-bar");
            fill = div("progress-fill");
            fill.style.width = percent + "%";
            progress.appendChild(fill);

            info.appendChild(name);
            info.appendChild(role);
            info.appendChild(steps);
            info.appendChild(progress);

            chevron = div("member-chevron", "›");

            row.appendChild(avatar);
            row.appendChild(info);
            row.appendChild(chevron);

            row.addEventListener("click", function () {
                openMember(this.getAttribute("data-id"));
            });

            list.appendChild(row);
        }
    }

    function showAddMember() {
        currentMemberId = null;
        byId("editTitle").textContent = "Add Member";
        byId("editSubtitle").textContent = "Create a family profile and set a daily step goal.";
        byId("nameInput").value = "";
        byId("roleInput").value = "Parent";
        byId("goalInput").value = "";
        showScreen("editScreen");
    }

    function showEditMember() {
        var member = getCurrentMember();
        if (!member) {
            goHome();
            return;
        }

        byId("editTitle").textContent = "Edit Member";
        byId("editSubtitle").textContent = "Update this member’s name, role or daily goal.";
        byId("nameInput").value = member.name;
        byId("roleInput").value = member.role;
        byId("goalInput").value = member.dailyGoal;
        showScreen("editScreen");
    }

    function saveMember() {
        var name = byId("nameInput").value.replace(/^\s+|\s+$/g, "");
        var role = byId("roleInput").value;
        var goal = Number(byId("goalInput").value || 6000);
        var existing = getCurrentMember();

        if (!name) {
            alert("Please enter a name.");
            return;
        }

        if (!goal || goal < 1) goal = 6000;

        if (existing) {
            existing.name = name;
            existing.role = normaliseRole(role);
            existing.dailyGoal = goal;
            saveMembers();
            openMember(existing.id);
            return;
        }

        members.push({
            id: createId(),
            name: name,
            role: normaliseRole(role),
            dailyGoal: goal,
            todaySteps: 0,
            history: []
        });

        saveMembers();
        goHome();
    }

    function openMember(id) {
        var member = null;
        var i;

        for (i = 0; i < members.length; i++) {
            if (members[i].id === id) {
                member = members[i];
                break;
            }
        }

        if (!member) {
            goHome();
            return;
        }

        currentMemberId = member.id;
        renderMemberDetail(member);
        showScreen("memberScreen");
    }

    function renderMemberDetail(member) {
        var percent = getPercent(member);
        var remaining = Math.max(0, Number(member.dailyGoal || 0) - Number(member.todaySteps || 0));

        byId("detailAvatar").textContent = getInitials(member.name);
        byId("detailName").textContent = member.name;
        byId("detailRole").textContent = member.role;
        byId("detailSteps").textContent = formatNumber(member.todaySteps);
        byId("detailGoalText").textContent = formatNumber(member.todaySteps) + " / " + formatNumber(member.dailyGoal) + " steps";
        byId("detailProgress").style.width = percent + "%";
        byId("detailPercent").textContent = percent + "% complete";
        byId("detailRemaining").textContent = formatNumber(remaining) + " left";

        renderBadge(member, percent);
        renderHistory(member);
    }

    function renderBadge(member, percent) {
        var area = byId("detailBadge");
        var text = "";
        var badge;

        clearElement(area);

        if (percent >= 100) text = "Goal reached 🎉";
        else if (percent >= 75) text = "Nearly there 🌿";
        else if (percent >= 50) text = "Halfway ⭐";
        else if (Number(member.todaySteps || 0) > 0) text = "Good start";

        if (text) {
            badge = document.createElement("span");
            badge.className = "badge";
            badge.textContent = text;
            area.appendChild(badge);
        }
    }

    function renderHistory(member) {
        var list = byId("historyList");
        var i;
        var item;
        var row;
        var date;
        var steps;

        clearElement(list);

        if (!member.history || member.history.length === 0) {
            list.appendChild(div("empty-state", "No history yet. It will appear after the next daily rollover."));
            return;
        }

        for (i = 0; i < member.history.length; i++) {
            item = member.history[i];
            row = div("history-item");
            date = div("history-date", formatDate(item.date));
            steps = div("history-steps", formatNumber(item.steps) + " steps");
            row.appendChild(date);
            row.appendChild(steps);
            list.appendChild(row);
        }
    }

    function addSteps(amount) {
        var member = getCurrentMember();
        var input = byId("addStepsInput");
        var value;

        if (!member) {
            goHome();
            return;
        }

        value = amount ? Number(amount) : Number(input.value || 0);

        if (!value || value <= 0) {
            alert("Please enter a step amount greater than 0.");
            return;
        }

        member.todaySteps = Math.max(0, Number(member.todaySteps || 0) + Math.round(value));
        saveMembers();
        input.value = "";
        openMember(member.id);
    }

    function deleteCurrentMember() {
        var member = getCurrentMember();
        var next = [];
        var i;

        if (!member) {
            goHome();
            return;
        }

        if (!confirm("Delete " + member.name + "? This cannot be undone.")) return;

        for (i = 0; i < members.length; i++) {
            if (members[i].id !== member.id) next.push(members[i]);
        }

        members = next;
        saveMembers();
        goHome();
    }

    function resetToday() {
        var i;
        if (members.length === 0) return;
        if (!confirm("Reset today’s steps for all members?")) return;

        for (i = 0; i < members.length; i++) {
            members[i].todaySteps = 0;
        }

        saveMembers();
        renderHome();
    }

    function resetAll() {
        if (!confirm("Reset ALL NeuroDirect data? This cannot be undone.")) return;

        members = [];
        currentMemberId = null;

        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.setItem(DATE_KEY, todayKey());
        } catch (ignore) {}

        goHome();
    }

    function attachEvents() {
        byId("addMemberBtn").addEventListener("click", showAddMember);
        byId("resetTodayBtn").addEventListener("click", resetToday);
        byId("resetAllBtn").addEventListener("click", resetAll);
        byId("saveMemberBtn").addEventListener("click", saveMember);
        byId("cancelEditBtn").addEventListener("click", goHome);
        byId("addStepsBtn").addEventListener("click", function () { addSteps(0); });
        byId("editMemberBtn").addEventListener("click", showEditMember);
        byId("deleteMemberBtn").addEventListener("click", deleteCurrentMember);
        byId("backHomeBtn").addEventListener("click", goHome);

        var quickButtons = document.querySelectorAll(".quickAddBtn");
        var i;
        for (i = 0; i < quickButtons.length; i++) {
            quickButtons[i].addEventListener("click", function () {
                addSteps(Number(this.getAttribute("data-amount")));
            });
        }
    }

    function registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("sw.js").catch(function () {
                /* Service worker is optional. App still works without it. */
            });
        }
    }

    function start() {
        try {
            loadMembers();
            rolloverCheck();
            attachEvents();
            renderHome();
            showScreen("homeScreen");
            registerServiceWorker();
        } catch (error) {
            showError(error && error.message ? error.message : String(error));
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
    } else {
        start();
    }
}());
