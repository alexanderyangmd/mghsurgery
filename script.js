// Track the currently displayed date globally
let currentDisplayDate = new Date();

// Function to load all schedules
async function loadAllSchedules() {
    try {
        // Check for auth token first
        const authToken = sessionStorage.getItem('authToken');
        if (!authToken) {
            console.log('No auth token found, skipping schedule load');
            updateScheduleDisplay({});
            updateChurchillAttendingDisplay(null);
            updateVascularAttendingDisplay(null);
            updateThoracicAttendingDisplay(null);
            updateCardiacAttendingDisplay(null);
            return;
        }

        console.log('Loading all schedules for date:', currentDisplayDate);
        const [teams, churchillAttendings, vascularAttendings, thoracicAttendings, cardiacAttendings] = await Promise.all([
            fetchAmionData(currentDisplayDate),
            fetchChurchillData(currentDisplayDate),
            fetchVascularData(currentDisplayDate),
            fetchThoracicData(currentDisplayDate),
            fetchCardiacData(currentDisplayDate)
        ]);

        console.log('Loaded schedules:', {
            teams: teams ? 'present' : 'missing',
            churchill: churchillAttendings ? 'present' : 'missing',
            vascular: vascularAttendings ? 'present' : 'missing',
            thoracic: thoracicAttendings ? 'present' : 'missing',
            cardiac: cardiacAttendings ? 'present' : 'missing'
        });

        updateScheduleDisplay(teams || {});
        updateChurchillAttendingDisplay(churchillAttendings);
        updateVascularAttendingDisplay(vascularAttendings);
        updateThoracicAttendingDisplay(thoracicAttendings);
        updateCardiacAttendingDisplay(cardiacAttendings);
    } catch (error) {
        console.error('Error loading schedules:', error);
        updateScheduleDisplay({});
        updateChurchillAttendingDisplay(null);
        updateVascularAttendingDisplay(null);
        updateThoracicAttendingDisplay(null);
        updateCardiacAttendingDisplay(null);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Update the date display initially
    const dateElement = document.querySelector('.date');
    if (dateElement) {
        const dayName = currentDisplayDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
        const monthDay = currentDisplayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
        dateElement.innerHTML = `
            <div class="day">${dayName}</div>
            <div class="number">${monthDay}</div>
        `;
    }

    // Date navigation
    const prevDate = document.querySelector('.ri-arrow-left-s-line');
    const nextDate = document.querySelector('.ri-arrow-right-s-line');
    
    if (prevDate && nextDate) {
        prevDate.addEventListener('click', () => updateDate(-1));
        nextDate.addEventListener('click', () => updateDate(1));
    }

    // Refresh button
    const refreshButtons = document.querySelectorAll('.refresh-icon');
    if (refreshButtons.length > 0) {
        refreshButtons.forEach(button => {
            button.addEventListener('click', () => {
                const now = new Date();
                const timeString = now.toLocaleTimeString('en-US', { 
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true 
                });
                
                // Update timestamp
                const lastUpdated = button.closest('.header-left')?.querySelector('.last-updated');
                if (lastUpdated) {
                    lastUpdated.textContent = `Last Updated: ${timeString}`;
                }
                
                // Reload all schedules
                loadAllSchedules();
            });
        });
    }

    // Check for authentication and load data
    const authToken = sessionStorage.getItem('authToken');
    if (authToken) {
        loadAllSchedules();
    }

    // Navigation handling
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const pages = document.querySelectorAll('.page');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            // Update active states
            navLinks.forEach(link => link.parentElement.classList.remove('active'));
            link.parentElement.classList.add('active');

            // Show selected page
            pages.forEach(page => {
                page.classList.remove('active');
                if (page.id === targetId) {
                    page.classList.add('active');
                }
            });
        });
    });
});

function updateDate(offset) {
    const dateElement = document.querySelector('.date');
    if (!dateElement) return;

    // Update the tracked date but keep year constant
    const newDate = new Date(currentDisplayDate);
    newDate.setDate(newDate.getDate() + offset);
    
    // If the new date would change the year, reset to Jan 1 or Dec 31
    if (newDate.getFullYear() !== currentDisplayDate.getFullYear()) {
        if (offset > 0) {
            newDate.setMonth(0);
            newDate.setDate(1);
        } else {
            newDate.setMonth(11);
            newDate.setDate(31);
        }
    }
    
    currentDisplayDate = newDate;
    
    const dayName = currentDisplayDate.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const monthDay = currentDisplayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    
    dateElement.innerHTML = `
        <div class="day">${dayName}</div>
        <div class="number">${monthDay}</div>
    `;
    
    // Load all schedules
    loadAllSchedules();
}

async function fetchAmionData(date) {
    try {
        // Format the date parameters
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear() - 1; // Subtract 1 from year for Amion's URL format
        
        console.log(`Fetching schedule for ${month}/${day}/${year+1} (using year=${year} in URL)`);
        const authToken = sessionStorage.getItem('authToken');
        const response = await fetch(`/api/schedule?day=${day}&month=${month}&year=${year}`, {
            headers: {
                'Authorization': 'Basic ' + authToken
            }
        });
        const csvText = await response.text();
        console.log('Received CSV data:', csvText);
        return parseAmionCSV(csvText);
    } catch (error) {
        console.error('Error fetching Amion data:', error);
        return null;
    }
}

function parseAmionCSV(csvText) {
    console.log('Starting CSV parsing');
    const lines = csvText.split('\n');
    const teams = {};
    
    // Skip header lines
    const dataLines = lines.slice(5);
    
    dataLines.forEach((line, index) => {
        if (!line.trim()) return;
        
        // Parse CSV line, handling quoted values correctly
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 9) return;
        
        const [name, , , role, , , date, startTime, endTime] = parts.map(p => p.replace(/"/g, '').trim());
        
        // Skip empty or header rows
        if (!name || !role || role === 'Assignment name') return;
        
        const member = {
            name,
            role,
            time: `${startTime}-${endTime}`
        };

        // Create team entry if it doesn't exist
        if (!teams[role]) {
            teams[role] = [];
        }
        teams[role].push(member);
    });
    
    console.log('Parsed teams:', teams);
    return teams;
}

async function fetchChurchillData(date) {
    try {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear(); // Note: No year offset for Churchill URL
        
        console.log(`Fetching Churchill schedule for ${month}/${day}/${year}`);
        const authToken = sessionStorage.getItem('authToken');
        const response = await fetch(`/api/churchill?day=${day}&month=${month}&year=${year}`, {
            headers: {
                'Authorization': 'Basic ' + authToken
            }
        });
        const csvText = await response.text();
        console.log('Received Churchill CSV data:', csvText);
        return parseChurchillCSV(csvText);
    } catch (error) {
        console.error('Error fetching Churchill data:', error);
        return null;
    }
}

function parseChurchillCSV(csvText) {
    console.log('Starting Churchill CSV parsing');
    const lines = csvText.split('\n');
    const attendings = {
        day: null,
        night: null,
        backup: null,
        pancreatitis: null,
        blueApp: []
    };
    
    // Skip header lines
    const dataLines = lines.slice(5);
    
    dataLines.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 9) return;
        
        const [name, , , role, , , , startTime, endTime] = parts.map(p => p.replace(/"/g, '').trim());
        
        // Match roles to their respective positions
        if (role === 'Churchill Day') {
            attendings.day = name;
        } else if (role === 'Churchill Night') {
            attendings.night = name;
        } else if (role === 'Backup') {
            attendings.backup = name;
        } else if (role === 'Pancreatitis') {
            attendings.pancreatitis = name;
        } else if (role.toLowerCase().includes('blue app')) {
            attendings.blueApp.push({
                name: name,
                time: `${startTime}-${endTime}`
            });
        }
    });
    
    console.log('Parsed Churchill attendings:', attendings);
    return attendings;
}

function updateChurchillAttendingDisplay(attendings) {
    console.log('Updating Churchill display with data:', attendings);
    
    // Get all elements first
    const elements = {
        day: document.getElementById('churchill-day-attending'),
        night: document.getElementById('churchill-night-attending'),
        backup: document.getElementById('churchill-backup'),
        pancreatitis: document.getElementById('churchill-pancreatitis')
    };

    // Log the state of all elements
    console.log('Churchill elements state:', Object.entries(elements).reduce((acc, [key, el]) => {
        acc[key] = el ? 'found' : 'missing';
        return acc;
    }, {}));

    if (!attendings) {
        console.log('No Churchill attendings data available');
        const placeholderText = 'Not Available';
        Object.values(elements).forEach(element => {
            if (element) element.textContent = placeholderText;
        });
        return true;
    }

    try {
        // Update the display with null checks
        if (elements.day) elements.day.textContent = attendings.day || 'Not Available';
        if (elements.night) elements.night.textContent = attendings.night || 'Not Available';
        if (elements.backup) elements.backup.textContent = attendings.backup || 'Not Available';
        if (elements.pancreatitis) elements.pancreatitis.textContent = attendings.pancreatitis || 'Not Available';
        
        // Create or update Blue team card
        const churchillSection = document.getElementById('churchill-team-section');
        const teamGrid = document.getElementById('churchill-team-grid');
        
        if (churchillSection && teamGrid) {
            // Remove existing Blue card if it exists
            const existingBlueCard = teamGrid.querySelector('.team-card.blue-team');
            if (existingBlueCard) {
                existingBlueCard.remove();
            }
            
            // Create new Blue card if there are Blue APP members
            if (attendings.blueApp && attendings.blueApp.length > 0) {
                console.log('Creating Blue card with members:', attendings.blueApp);
                const blueCard = document.createElement('div');
                blueCard.className = 'team-card';
                
                const blueTitle = document.createElement('h4');
                blueTitle.textContent = 'Churchill Blue';
                blueCard.appendChild(blueTitle);
                
                // Add each Blue APP member
                attendings.blueApp.forEach(member => {
                    const memberDiv = document.createElement('div');
                    memberDiv.className = 'team-member';
                    memberDiv.innerHTML = `
                        <span class="member-role">APP</span>
                        <span class="member-name">${member.name}</span>
                        <span class="member-time">${member.time || '0700-1800'}</span>
                    `;
                    blueCard.appendChild(memberDiv);
                });
                
                // Insert the Blue card between Green and Overnight cards
                const nightCard = teamGrid.querySelector('.team-card.night-card');
                if (nightCard) {
                    nightCard.before(blueCard);
                } else {
                    teamGrid.appendChild(blueCard);
                }
            } else {
                console.log('No Blue APP members found in data');
            }
        }

        console.log('Churchill display update complete');
        return true;
    } catch (error) {
        console.error('Error updating Churchill display:', error);
        return false;
    }
}

function findTeamMember(teams, role) {
    if (!teams || typeof teams !== 'object') return null;
    
    const entry = Object.entries(teams).find(([teamRole, members]) => 
        teamRole.toLowerCase() === role.toLowerCase()
    );
    
    return entry ? entry[1][0]?.name : null;
}

function updateScheduleDisplay(teams) {
    console.log('Updating display with teams:', teams);
    
    // Get the containers
    const pitSection = document.getElementById('pit-team-grid');
    const bakerSection = document.getElementById('baker-team-grid');
    const churchillSection = document.getElementById('churchill-team-grid');
    const thoracicsSection = document.getElementById('thoracics-team-grid');
    const vascularSection = document.getElementById('vascular-team-grid');
    const pediatricsSection = document.getElementById('pediatrics-team-grid');
    const transplantSection = document.getElementById('transplant-team-grid');
    const unavailableMessage = document.getElementById('schedule-unavailable');
    const pitTeamSection = document.getElementById('pit-team-section');
    const bakerTeamSection = document.getElementById('baker-team-section');
    const churchillTeamSection = document.getElementById('churchill-team-section');
    const thoracicsTeamSection = document.getElementById('thoracics-section');
    const vascularTeamSection = document.getElementById('vascular-section');
    const pediatricsTeamSection = document.getElementById('pediatrics-section');
    const transplantTeamSection = document.getElementById('transplant-section');
    
    if (!pitSection || !bakerSection || !churchillSection || !thoracicsSection || !vascularSection || !pediatricsSection || !transplantSection || !unavailableMessage || 
        !pitTeamSection || !bakerTeamSection || !churchillTeamSection || !thoracicsTeamSection || !vascularTeamSection || !pediatricsTeamSection || !transplantTeamSection) {
        console.error('Could not find required containers');
        return;
    }

    // If no teams data or empty teams object
    if (!teams || Object.keys(teams).length === 0) {
        unavailableMessage.style.display = 'flex';
        pitTeamSection.style.display = 'none';
        bakerTeamSection.style.display = 'none';
        churchillTeamSection.style.display = 'none';
        thoracicsTeamSection.style.display = 'none';
        vascularTeamSection.style.display = 'none';
        pediatricsTeamSection.style.display = 'none';
        transplantTeamSection.style.display = 'none';
        return;
    }

    // Hide unavailable message and show team sections
    unavailableMessage.style.display = 'none';
    pitTeamSection.style.display = 'block';
    bakerTeamSection.style.display = 'block';
    churchillTeamSection.style.display = 'block';
    thoracicsTeamSection.style.display = 'block';
    vascularTeamSection.style.display = 'block';
    pediatricsTeamSection.style.display = 'block';
    transplantTeamSection.style.display = 'block';

    // Clear existing content
    pitSection.innerHTML = '';
    bakerSection.innerHTML = '';
    churchillSection.innerHTML = '';
    thoracicsSection.innerHTML = '';
    vascularSection.innerHTML = '';
    pediatricsSection.innerHTML = '';
    transplantSection.innerHTML = '';

    // Process pediatrics team members
    const pediatricsDay = document.createElement('div');
    pediatricsDay.className = 'team-card';
    
    const pediatricsDayTitle = document.createElement('h4');
    pediatricsDayTitle.textContent = 'Day';
    pediatricsDay.appendChild(pediatricsDayTitle);

    const pediatricsNight = document.createElement('div');
    pediatricsNight.className = 'team-card night-card';
    
    const pediatricsNightTitle = document.createElement('h4');
    pediatricsNightTitle.textContent = 'Night';
    pediatricsNight.appendChild(pediatricsNightTitle);

    // Find pediatrics team members
    Object.entries(teams).forEach(([role, members]) => {
        if (role.toLowerCase().includes('pedi')) {
            const member = members[0]; // Get first member
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            
            // Determine role label and card placement
            let roleLabel;
            if (role.toLowerCase().includes('senior')) {
                roleLabel = 'Senior';
            } else if (role.toLowerCase().includes('intern')) {
                roleLabel = 'Intern';
            }
            
            memberDiv.innerHTML = `
                <span class="member-role">${roleLabel}</span>
                <span class="member-name">${member.name}</span>
                <span class="member-time">${member.time}</span>
            `;
            
            // Add to appropriate card
            if (role.toLowerCase().includes('night')) {
                pediatricsNight.appendChild(memberDiv);
            } else {
                pediatricsDay.appendChild(memberDiv);
            }
        }
    });

    // Add cards to pediatrics section
    pediatricsSection.appendChild(pediatricsDay);
    pediatricsSection.appendChild(pediatricsNight);

    // Process thoracics team members
    const thoracicsDay = document.createElement('div');
    thoracicsDay.className = 'team-card';
    
    const thoracicsDayTitle = document.createElement('h4');
    thoracicsDayTitle.textContent = 'Day';
    thoracicsDay.appendChild(thoracicsDayTitle);

    // Create Night Card
    const thoracicsNight = document.createElement('div');
    thoracicsNight.className = 'team-card night-card';
    
    const thoracicsNightTitle = document.createElement('h4');
    thoracicsNightTitle.textContent = 'Night';
    thoracicsNight.appendChild(thoracicsNightTitle);

    // Find thoracics team members
    Object.entries(teams).forEach(([role, members]) => {
        if (role.toLowerCase().includes('thoracic')) {
            const member = members[0]; // Get first member
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            
            // Determine role label and card placement
            let roleLabel;
            if (role.toLowerCase().includes('consult')) {
                roleLabel = 'Consult';
            } else if (role.toLowerCase().includes('intern')) {
                roleLabel = 'Intern';
            } else if (role.toLowerCase().includes('night float')) {
                roleLabel = 'Night Float';
            }
            
            memberDiv.innerHTML = `
                <span class="member-role">${roleLabel}</span>
                <span class="member-name">${member.name}</span>
                <span class="member-time">${member.time}</span>
            `;
            
            // Add to appropriate card
            if (role.toLowerCase().includes('night float')) {
                thoracicsNight.appendChild(memberDiv);
            } else {
                thoracicsDay.appendChild(memberDiv);
            }
        }
    });

    // Clear existing content and append new cards
    thoracicsSection.innerHTML = '';
    thoracicsSection.appendChild(thoracicsDay);
    thoracicsSection.appendChild(thoracicsNight);

    // Process vascular team members
    const vascularDay = document.createElement('div');
    vascularDay.className = 'team-card';
    
    const vascularDayTitle = document.createElement('h4');
    vascularDayTitle.textContent = 'Day';
    vascularDay.appendChild(vascularDayTitle);

    // Create Night Card
    const vascularNight = document.createElement('div');
    vascularNight.className = 'team-card night-card';
    
    const vascularNightTitle = document.createElement('h4');
    vascularNightTitle.textContent = 'Night';
    vascularNight.appendChild(vascularNightTitle);

    // Find vascular team members
    Object.entries(teams).forEach(([role, members]) => {
        if (role.toLowerCase().includes('vascular')) {
            const member = members[0]; // Get first member
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            
            // Skip pager entries and night consult entries
            if (role.toLowerCase().includes('pager') || 
                (role.toLowerCase().includes('consult') && role.toLowerCase().includes('night'))) {
                return;
            }
            
            // Determine role label and card placement
            let roleLabel;
            if (role.toLowerCase().includes('night float')) {
                roleLabel = 'Night Float';
                vascularNight.appendChild(memberDiv);
            } else if (role.toLowerCase().includes('consult resident day')) {
                roleLabel = 'Consult';
                vascularDay.appendChild(memberDiv);
            } else {
                return; // Skip any other entries
            }
            
            memberDiv.innerHTML = `
                <span class="member-role">${roleLabel}</span>
                <span class="member-name">${member.name}</span>
                <span class="member-time">${member.time}</span>
            `;
        }
    });
    
    vascularSection.appendChild(vascularDay);
    vascularSection.appendChild(vascularNight);

    // Process transplant team members
    const transplantDay = document.createElement('div');
    transplantDay.className = 'team-card';
    
    const transplantDayTitle = document.createElement('h4');
    transplantDayTitle.textContent = 'Day';
    transplantDay.appendChild(transplantDayTitle);

    const transplantNight = document.createElement('div');
    transplantNight.className = 'team-card night-card';
    
    const transplantNightTitle = document.createElement('h4');
    transplantNightTitle.textContent = 'Night';
    transplantNight.appendChild(transplantNightTitle);

    // Find transplant team members
    Object.entries(teams).forEach(([role, members]) => {
        if (role.toLowerCase().includes('txp') || role.toLowerCase().includes('burn and transplant')) {
            const member = members[0]; // Get first member
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            
            // Determine role label and card placement
            let roleLabel;
            if (role.toLowerCase().includes('senior')) {
                roleLabel = 'Senior';
            } else if (role.toLowerCase().includes('intern')) {
                roleLabel = 'Intern';
            } else if (role.toLowerCase().includes('burn and transplant night')) {
                roleLabel = 'Senior';
            }
            
            memberDiv.innerHTML = `
                <span class="member-role">${roleLabel}</span>
                <span class="member-name">${member.name}</span>
                <span class="member-time">${member.time}</span>
            `;
            
            // Add to appropriate card
            if (role.toLowerCase().includes('night')) {
                transplantNight.appendChild(memberDiv);
            } else {
                transplantDay.appendChild(memberDiv);
            }
        }
    });

    // Add cards to transplant section
    transplantSection.appendChild(transplantDay);
    transplantSection.appendChild(transplantNight);

    // Initialize team objects
    const bakerTeams = {};
    const bakerOvernight = {
        title: 'Baker Overnight',
        members: []
    };
    const bakerWeekendDay = {
        title: 'Baker Day',
        members: []
    };
    const churchillTeams = {
        'Red': [],
        'White': [],
        'Green': [],
        'Overnight': []
    };
    let isWeekendSchedule = false;

    // First pass: organize members into teams
    Object.entries(teams).forEach(([role, members]) => {
        const roleLower = role.toLowerCase();
        
        // Process Baker teams
        if (roleLower.includes('baker')) {
            // Check for weekend schedule indicators
            if (roleLower.includes('weekend') || roleLower.includes('holiday')) {
                isWeekendSchedule = true;
                
                // Sort into Day vs Overnight
                if (roleLower.includes('night float') || roleLower.includes('overnight') || 
                    roleLower.includes('boss')) {
                    bakerOvernight.members.push(...members);
                } else {
                    // Map weekend roles to standardized display names
                    members.forEach(member => {
                        const memberCopy = { ...member };
                        if (roleLower.includes('on call')) {
                            memberCopy.role = 'On Call Senior';
                        } else if (roleLower.includes('rounding')) {
                            memberCopy.role = 'Rounding Senior';
                        } else if (roleLower.includes('intern long')) {
                            memberCopy.role = 'Long Intern';
                        } else if (roleLower.includes('intern short')) {
                            memberCopy.role = 'Short Intern';
                        }
                        bakerWeekendDay.members.push(memberCopy);
                    });
                }
            } else if (roleLower.includes('night float') || roleLower.includes('overnight') || 
                      roleLower.includes('boss')) {
                bakerOvernight.members.push(...members);
            } else {
                // Regular weekday team handling
                const match = roleLower.match(/baker\s*(\d+[ab]?)/i);
                if (match) {
                    let teamNumber = match[1];
                    if (teamNumber.endsWith('a') || teamNumber.endsWith('b')) {
                        teamNumber = teamNumber.slice(0, -1) + teamNumber.slice(-1).toUpperCase();
                    }
                    
                    if (!bakerTeams[teamNumber]) {
                        bakerTeams[teamNumber] = [];
                    }
                    bakerTeams[teamNumber].push(...members);
                }
            }
        }
        
        // Process Churchill teams
        if (roleLower.includes('churchill') || roleLower.includes('cnf')) {
            members.forEach(member => {
                // Track members already added to overnight team
                const memberKey = `${member.name}-${member.time}`;
                
                if ((roleLower.includes('night') || roleLower.includes('cnf'))) {
                    // For overnight team, check if this member is already added
                    if (!churchillTeams['Overnight'].some(m => `${m.name}-${m.time}` === memberKey)) {
                        churchillTeams['Overnight'].push(member);
                    }
                } else {
                    // Determine which Churchill team
                    if (roleLower.includes('red')) {
                        churchillTeams['Red'].push(member);
                    } else if (roleLower.includes('white')) {
                        churchillTeams['White'].push(member);
                    } else if (roleLower.includes('green')) {
                        churchillTeams['Green'].push(member);
                    }
                }
            });
        }
    });

    // Display Churchill teams
    Object.entries(churchillTeams).forEach(([teamName, members]) => {
        if (members.length > 0) {
            const teamCard = document.createElement('div');
            teamCard.className = 'team-card';
            if (teamName === 'Overnight') {
                teamCard.className += ' night-card';
            }
            
            const teamTitle = document.createElement('h4');
            teamTitle.textContent = `Churchill ${teamName}`;
            
            // Check if this team is on call
            const onCallTeam = Object.entries(teams).find(([role, members]) => 
                role.toLowerCase() === 'churchill team on call'
            );
            
            if (onCallTeam) {
                const onCallName = onCallTeam[1][0]?.name;
                if (onCallName && onCallName.toLowerCase() === teamName.toLowerCase()) {
                    const onCallBadge = document.createElement('span');
                    onCallBadge.className = 'on-call-badge';
                    onCallBadge.textContent = 'On Call';
                    teamTitle.appendChild(onCallBadge);
                }
            }
            
            teamCard.appendChild(teamTitle);
            
            // Sort members (Senior first, then interns)
            members.sort((a, b) => {
                const aIsSenior = a.role.toLowerCase().includes('senior') || 
                                a.role.toLowerCase().includes('chief');
                const bIsSenior = b.role.toLowerCase().includes('senior') || 
                                b.role.toLowerCase().includes('chief');
                return bIsSenior - aIsSenior;
            });
            
            members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'team-member';
                
                // Determine role label
                let roleLabel = 'Senior';
                if (member.role.toLowerCase().includes('intern')) {
                    roleLabel = 'Intern';
                } else if (member.role.toLowerCase().includes('cnf chief')) {
                    roleLabel = 'Senior';
                }
                
                memberDiv.innerHTML = `
                    <span class="member-role">${roleLabel}</span>
                    <span class="member-name">${member.name}</span>
                    <span class="member-time">${member.time}</span>
                `;
                teamCard.appendChild(memberDiv);
            });
            
            churchillSection.appendChild(teamCard);
        }
    });

    // Process and display Pit Team members
    const pitTeamMembers = Object.entries(teams)
        .filter(([role]) => role.toLowerCase().includes('pit'))
        .map(([role, members]) => members)
        .flat();

    if (pitTeamMembers.length > 0) {
        // Create Day Card
        const pitDayCard = document.createElement('div');
        pitDayCard.className = 'team-card';
        
        const dayTitle = document.createElement('h4');
        dayTitle.textContent = 'Day';
        pitDayCard.appendChild(dayTitle);

        // Create Night Card
        const pitNightCard = document.createElement('div');
        pitNightCard.className = 'team-card night-card';
        
        const nightTitle = document.createElement('h4');
        nightTitle.textContent = 'Night';
        pitNightCard.appendChild(nightTitle);

        // Sort and distribute members to day/night cards
        pitTeamMembers.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            
            // Simplify role label
            let roleLabel = member.role.toLowerCase().includes('senior') ? 'Senior' : 'Junior';
            
            memberDiv.innerHTML = `
                <span class="member-role">${roleLabel}</span>
                <span class="member-name">${member.name}</span>
                <span class="member-time">${member.time}</span>
            `;
            
            // Add to appropriate card based on role
            if (member.role.toLowerCase().includes('night')) {
                pitNightCard.appendChild(memberDiv);
            } else {
                pitDayCard.appendChild(memberDiv);
            }
        });
        
        pitSection.appendChild(pitDayCard);
        pitSection.appendChild(pitNightCard);
    }

    // Display Baker teams based on schedule type
    if (isWeekendSchedule) {
        // Display weekend schedule
        if (bakerWeekendDay.members.length > 0) {
            const dayCard = document.createElement('div');
            dayCard.className = 'team-card';
            
            const dayTitle = document.createElement('h4');
            dayTitle.textContent = bakerWeekendDay.title;
            dayCard.appendChild(dayTitle);
            
            // Sort members by role priority
            const rolePriority = {
                'On Call Senior': 1,
                'Rounding Senior': 2,
                'Long Intern': 3,
                'Short Intern': 4
            };
            
            bakerWeekendDay.members.sort((a, b) => 
                (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99)
            );
            
            bakerWeekendDay.members.forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'team-member';
                memberDiv.innerHTML = `
                    <span class="member-role">${member.role}</span>
                    <span class="member-name">${member.name}</span>
                    <span class="member-time">${member.time}</span>
                `;
                dayCard.appendChild(memberDiv);
            });
            
            bakerSection.appendChild(dayCard);
        }
    } else {
        // Regular weekday display logic
        const sortedTeamNumbers = Object.keys(bakerTeams).sort((a, b) => {
            const aBase = parseInt(a.match(/\d+/)[0]);
            const bBase = parseInt(b.match(/\d+/)[0]);
            
            if (aBase === bBase) {
                return a.includes('A') ? -1 : a.includes('B') ? 1 : 0;
            }
            return aBase - bBase;
        });

        // Create and append Baker team cards
        sortedTeamNumbers.forEach(teamNumber => {
            const teamCard = document.createElement('div');
            teamCard.className = 'team-card';
            
            const teamTitle = document.createElement('h4');
            teamTitle.textContent = `Baker ${teamNumber}`;
            teamCard.appendChild(teamTitle);
            
            // Sort members (Chief first, then others)
            bakerTeams[teamNumber].sort((a, b) => {
                const aIsChief = a.role.toLowerCase().includes('chief');
                const bIsChief = b.role.toLowerCase().includes('chief');
                return bIsChief - aIsChief;
            });
            
            bakerTeams[teamNumber].forEach(member => {
                const memberDiv = document.createElement('div');
                memberDiv.className = 'team-member';
                const roleLabel = member.role.toLowerCase().includes('chief') ? 'Chief' : 'Intern';
                memberDiv.innerHTML = `
                    <span class="member-role">${roleLabel}</span>
                    <span class="member-name">${member.name}</span>
                    <span class="member-time">${member.time}</span>
                `;
                teamCard.appendChild(memberDiv);
            });
            
            bakerSection.appendChild(teamCard);
        });

        // Add Breast team card
        const breastTeam = Object.entries(teams).find(([role]) => role === 'Breast');
        if (breastTeam) {
            const breastCard = document.createElement('div');
            breastCard.className = 'team-card';
            
            const breastTitle = document.createElement('h4');
            breastTitle.textContent = 'Breast';
            breastCard.appendChild(breastTitle);
            
            const member = breastTeam[1][0];
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            memberDiv.innerHTML = `
                <span class="member-role">Senior</span>
                <span class="member-name">${member.name}</span>
                <span class="member-time">${member.time}</span>
            `;
            breastCard.appendChild(memberDiv);
            
            bakerSection.appendChild(breastCard);
        }
    }

    // Add Baker overnight card if there are overnight members
    if (bakerOvernight.members.length > 0) {
        const overnightCard = document.createElement('div');
        overnightCard.className = 'team-card night-card';
        
        const overnightTitle = document.createElement('h4');
        overnightTitle.textContent = bakerOvernight.title;
        overnightCard.appendChild(overnightTitle);
        
        // Sort members to ensure BOSS is first
        bakerOvernight.members.sort((a, b) => {
            const aIsBoss = a.role.toLowerCase().includes('boss');
            const bIsBoss = b.role.toLowerCase().includes('boss');
            return bIsBoss - aIsBoss;
        });
        
        bakerOvernight.members.forEach(member => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            
            // Simplify role labels
            let roleLabel = 'Intern';
            if (member.role.toLowerCase().includes('boss')) {
                roleLabel = 'BOSS';
            }
            
            memberDiv.innerHTML = `
                <span class="member-role">${roleLabel}</span>
                <span class="member-name">${member.name}</span>
                <span class="member-time">${member.time}</span>
            `;
            overnightCard.appendChild(memberDiv);
        });
        
        bakerSection.appendChild(overnightCard);
    }

    // Show/hide sections based on content
    if (pitTeamSection) pitTeamSection.style.display = pitSection.children.length > 0 ? 'block' : 'none';
    if (bakerTeamSection) bakerTeamSection.style.display = bakerSection.children.length > 0 ? 'block' : 'none';
    if (churchillTeamSection) churchillTeamSection.style.display = churchillSection.children.length > 0 ? 'block' : 'none';
    if (thoracicsTeamSection) thoracicsTeamSection.style.display = thoracicsSection.children.length > 0 ? 'block' : 'none';
    if (vascularTeamSection) vascularTeamSection.style.display = vascularSection.children.length > 0 ? 'block' : 'none';
    if (pediatricsTeamSection) pediatricsTeamSection.style.display = pediatricsSection.children.length > 0 ? 'block' : 'none';
    if (transplantTeamSection) transplantTeamSection.style.display = transplantSection.children.length > 0 ? 'block' : 'none';

    // Always show sections with attending banners, regardless of team members
    const cardiacSection = document.getElementById('cardiac-section');
    if (cardiacSection) cardiacSection.style.display = 'block';

    // Show unavailable message if no teams are displayed
    if (unavailableMessage) {
        const anyTeamsVisible = [
            pitTeamSection, bakerTeamSection, churchillTeamSection,
            thoracicsTeamSection, vascularTeamSection, pediatricsTeamSection,
            transplantTeamSection
        ].some(section => section && section.style.display === 'block');

        unavailableMessage.style.display = anyTeamsVisible ? 'none' : 'block';
    }
}

function updateThoracicsSection(data) {
    // Update thoracics team members
    document.getElementById('thoracic-consult-resident').textContent = 
        findTeamMember(data, 'Thoracic Consult') || 'Not assigned';
    document.getElementById('thoracic-intern').textContent = 
        findTeamMember(data, 'Thoracic Intern') || 'Not assigned';
    document.getElementById('thoracic-night-float').textContent = 
        findTeamMember(data, 'Thoracic Night Float') || 'Not assigned';
}

// Add thoracics update to the main update function
function updateSchedule(data) {
    // ... existing code ...
    
    // Update thoracics section
    updateThoracicsSection(data);
    
    // ... existing code ...
}

async function fetchVascularData(date) {
    try {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        const authToken = sessionStorage.getItem('authToken');
        if (!authToken) return null;
        
        const response = await fetch(`/api/vascular?day=${day}&month=${month}&year=${year}`, {
            headers: {
                'Authorization': 'Basic ' + authToken
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        if (!csvText || csvText.trim() === '') return null;
        
        const attendings = parseVascularCSV(csvText);
        
        // Validate the parsed data
        if (!attendings || (!attendings.attending && !attendings.fellow)) return null;
        
        return attendings;
    } catch (error) {
        console.error('Error fetching Vascular data:', error);
        return null;
    }
}

function parseVascularCSV(csvText) {
    const lines = csvText.split('\n');
    const attendings = {
        attending: null,
        fellow: null
    };
    
    // Skip header lines
    const dataLines = lines.slice(5);
    
    dataLines.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 4) return;
        
        const [name, , , role] = parts.map(p => p.replace(/"/g, '').trim());
        
        // Match roles to their respective positions
        if (role === 'MGH Surgeon On-Call') {
            attendings.attending = name;
        } else if (role === 'MGH Fellow On-Call') {
            attendings.fellow = name;
        }
    });
    
    return attendings;
}

function updateVascularAttendingDisplay(attendings) {
    const attendingElement = document.getElementById('vascular-attending');
    const fellowElement = document.getElementById('vascular-fellow');
    
    if (!attendingElement || !fellowElement) {
        console.error('Could not find vascular display elements');
        return;
    }
    
    if (!attendings) {
        attendingElement.textContent = 'Not Available';
        fellowElement.textContent = 'Not Available';
        return;
    }

    // Update attending - extract last name only
    if (attendings.attending && attendings.attending.trim()) {
        const lastName = attendings.attending.split(' ')[1].split(',')[0];
        attendingElement.textContent = lastName;
    } else {
        attendingElement.textContent = 'Not Available';
    }

    // Update fellow - extract last name only
    if (attendings.fellow && attendings.fellow.trim()) {
        const lastName = attendings.fellow.split(' ')[1].split(',')[0];
        fellowElement.textContent = lastName;
    } else {
        fellowElement.textContent = 'Not Available';
    }
}

async function fetchThoracicData(date) {
    try {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        const authToken = sessionStorage.getItem('authToken');
        if (!authToken) return null;
        
        const response = await fetch(`/api/thoracic?day=${day}&month=${month}&year=${year}`, {
            headers: {
                'Authorization': 'Basic ' + authToken
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        if (!csvText || csvText.trim() === '') return null;
        
        const attendings = parseThoracicCSV(csvText);
        return attendings;
    } catch (error) {
        console.error('Error fetching Thoracic schedule:', error);
        return null;
    }
}

function parseThoracicCSV(csvText) {
    const lines = csvText.split('\n');
    const attendings = {
        attending: null,
        fellow: null
    };
    
    // Skip header lines
    const dataLines = lines.slice(5);
    
    dataLines.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.match(/(\".*?\"|[^\",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 4) return;
        
        const [name, , , role] = parts.map(p => p.replace(/\"/g, '').trim());
        
        // Match roles to their respective positions
        if (role === 'MGH & MD Connect') {
            attendings.attending = name;
        } else if (role === 'Fellow On Call (24 hr)') {
            attendings.fellow = name;
        }
    });
    
    return attendings;
}

function updateThoracicAttendingDisplay(attendings) {
    const attendingElement = document.getElementById('thoracic-attending');
    const fellowElement = document.getElementById('thoracic-fellow');
    
    if (!attendings) {
        attendingElement.textContent = 'Error loading data';
        fellowElement.textContent = 'Error loading data';
        return;
    }
    
    // Update the attending and fellow names
    attendingElement.textContent = attendings.attending || 'Not assigned';
    fellowElement.textContent = attendings.fellow || 'Not assigned';
}

async function fetchCardiacData(date) {
    try {
        const day = date.getDate();
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        const authToken = sessionStorage.getItem('authToken');
        if (!authToken) return null;
        
        const response = await fetch(`/api/cardiac?day=${day}&month=${month}&year=${year}`, {
            headers: {
                'Authorization': 'Basic ' + authToken
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        if (!csvText || csvText.trim() === '') return null;
        
        const attendings = parseCardiacCSV(csvText);
        return attendings;
    } catch (error) {
        console.error('Error loading cardiac data:', error);
        return null;
    }
}

function parseCardiacCSV(csvText) {
    const lines = csvText.split('\n');
    const attendings = {
        attending: null,
        fellow: null
    };
    
    console.log('Parsing cardiac CSV data:', csvText);
    
    // Skip header lines
    const dataLines = lines.slice(5);
    
    // Log all roles we find
    const allRoles = new Set();
    
    dataLines.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 4) return;
        
        // Extract division and role
        const [division, name, , , role] = parts.map(p => p.replace(/"/g, '').trim());
        allRoles.add(role);
        
        // Match roles to their respective positions
        if (division === 'Attendings' && role === 'General Cardiac Call') {
            console.log('Found cardiac attending:', name, 'with role:', role);
            attendings.attending = name;
        } else if (division === 'Resident' && role === 'In House Fellow') {
            console.log('Found cardiac fellow:', name, 'with role:', role);
            attendings.fellow = name;
        }
    });
    
    console.log('All roles found in cardiac data:', Array.from(allRoles));
    console.log('Parsed cardiac attendings:', attendings);
    return attendings;
}

function updateCardiacAttendingDisplay(attendings) {
    // First ensure the main content is visible
    const mainContent = document.getElementById('main-content');
    if (mainContent && mainContent.classList.contains('hidden')) {
        console.log('Main content is hidden, waiting for it to become visible');
        setTimeout(() => updateCardiacAttendingDisplay(attendings), 500);
        return;
    }

    // Then ensure we're on the correct page
    const onCallPage = document.getElementById('on-call');
    if (onCallPage && !onCallPage.classList.contains('active')) {
        console.log('Not on the on-call page, cardiac elements may not be visible');
        return;
    }

    // Find or create the cardiac section
    let cardiacSection = document.getElementById('cardiac-section');
    if (!cardiacSection) {
        console.log('Creating cardiac section...');
        cardiacSection = document.createElement('div');
        cardiacSection.id = 'cardiac-section';
        cardiacSection.className = 'team-section';
        cardiacSection.innerHTML = `
            <h3>Cardiac</h3>
            <div class="attending-banner">
                <div class="attending-role-row">
                    <span class="role-label">On-Call Attending:</span>
                    <span class="attending-name" id="cardiac-attending">Loading...</span>
                </div>
                <div class="attending-role-row">
                    <span class="role-label">On-Call Fellow:</span>
                    <span class="attending-name" id="cardiac-fellow">Loading...</span>
                </div>
            </div>
            <div id="cardiac-team-grid" class="team-grid"></div>
        `;

        // Insert it before the last section (Resources)
        const contentBody = document.querySelector('.content-body');
        if (contentBody) {
            contentBody.appendChild(cardiacSection);
            console.log('Cardiac section added to DOM');
        } else {
            console.error('Could not find content-body to add cardiac section');
            return;
        }
    }

    // Ensure the section is visible
    cardiacSection.style.display = 'block';

    // Get the elements after creating/finding the section
    const attendingElement = document.getElementById('cardiac-attending');
    const fellowElement = document.getElementById('cardiac-fellow');

    // Add debug logging
    console.log('Cardiac elements after creation/find:', {
        attending: attendingElement ? 'found' : 'missing',
        fellow: fellowElement ? 'found' : 'missing',
        section: cardiacSection ? 'found' : 'missing'
    });

    if (!attendingElement || !fellowElement) {
        console.error('Could not find cardiac display elements even after creation');
        return;
    }

    // Update the display
    if (!attendings) {
        attendingElement.textContent = 'Not Available';
        fellowElement.textContent = 'Not Available';
        return;
    }

    // Update attending - extract last name only
    if (attendings.attending && attendings.attending.trim()) {
        const nameParts = attendings.attending.split(' ');
        const lastName = nameParts.length > 1 ? nameParts[1].split(',')[0] : attendings.attending;
        attendingElement.textContent = lastName;
    } else {
        attendingElement.textContent = 'Not Available';
    }

    // Update fellow - extract last name only
    if (attendings.fellow && attendings.fellow.trim()) {
        const nameParts = attendings.fellow.split(' ');
        const lastName = nameParts.length > 1 ? nameParts[1].split(',')[0] : attendings.fellow;
        fellowElement.textContent = lastName;
    } else {
        fellowElement.textContent = 'Not Available';
    }
}

function updatePhoneGrids(contacts, activeCategory = 'all') {
    console.log('Updating phone grids with category:', activeCategory, 'Contacts:', contacts);
    
    // Get all phone category sections
    const phoneSections = document.querySelectorAll('.phone-category');
    
    if (!phoneSections || phoneSections.length === 0) {
        console.error('No phone category sections found');
        return;
    }

    // Create a map of category names to display names
    const categoryMap = {};
    contacts.forEach(contact => {
        if (contact.category_name) {
            categoryMap[contact.category_name.toLowerCase()] = contact.category_display_name;
        }
    });

    // Filter contacts based on active category
    const filteredContacts = activeCategory === 'all' 
        ? contacts 
        : contacts.filter(contact => 
            contact.category_name && 
            contact.category_name.toLowerCase() === activeCategory.toLowerCase()
        );

    // Update sections based on active category
    phoneSections.forEach(section => {
        const sectionCategory = section.dataset.category;
        if (!sectionCategory) {
            console.error('Section missing category:', section);
            return;
        }

        const grid = section.querySelector('.phone-grid');
        if (!grid) return;

        if (activeCategory === 'all' || sectionCategory.toLowerCase() === activeCategory.toLowerCase()) {
            const sectionContacts = activeCategory === 'all'
                ? contacts.filter(contact => 
                    contact.category_name && 
                    contact.category_name.toLowerCase() === sectionCategory.toLowerCase()
                )
                : filteredContacts;

            if (sectionContacts.length > 0) {
                grid.innerHTML = sectionContacts
                    .map(contact => createPhoneCard(contact))
                    .join('');
                section.style.display = 'block';
            } else {
                grid.innerHTML = '<div class="no-results">No contacts found</div>';
                section.style.display = activeCategory === 'all' ? 'none' : 'block';
            }
        } else {
            section.style.display = 'none';
        }
    });
}

// Update initializePhoneDirectory function
function initializePhoneDirectory() {
    console.log('Initializing phone directory');
    
    // Remove any existing search inputs first
    const existingSearch = document.querySelector('.phone-search');
    if (existingSearch) {
        existingSearch.remove();
    }

    // Phone Directory Functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search contacts...';
    searchInput.className = 'phone-search';
    
    // Add search input to the category tabs container
    const categoryTabs = document.querySelector('.category-tabs');
    if (categoryTabs) {
        categoryTabs.parentNode.insertBefore(searchInput, categoryTabs.nextSibling);
    }

    // Set up phone directory sections
    const phoneDirectory = document.querySelector('.phone-directory');
    if (phoneDirectory) {
        // Clear existing sections
        const existingSections = phoneDirectory.querySelectorAll('.phone-category');
        existingSections.forEach(section => section.remove());

        // Create sections for each category
        const categories = ['attending', 'resident', 'app', 'other'];
        const displayNames = {
            'attending': 'Attendings',
            'resident': 'Residents',
            'app': 'APPs',
            'other': 'Other'
        };

        categories.forEach(category => {
            const section = document.createElement('div');
            section.className = 'phone-category';
            section.dataset.category = category;
            
            const title = document.createElement('h3');
            title.textContent = displayNames[category];
            section.appendChild(title);
            
            const grid = document.createElement('div');
            grid.className = 'phone-grid';
            section.appendChild(grid);
            
            phoneDirectory.appendChild(section);
        });
    }

    // Set initial active state and ensure data-category attributes are set
    tabButtons.forEach(button => {
        // Set data-category if not already set
        if (!button.dataset.category) {
            // Get category from text content or id
            const category = button.textContent.trim().toLowerCase();
            button.dataset.category = category;
        }
        
        // Remove any existing click listeners
        button.replaceWith(button.cloneNode(true));
    });

    // Re-query buttons after replacing them
    const newTabButtons = document.querySelectorAll('.tab-button');
    const firstTab = newTabButtons[0];
    if (firstTab) {
        firstTab.classList.add('active');
    }

    // Initialize phone directory with 'all' category
    loadPhoneDirectory('all', '');

    // Handle category tab clicks
    newTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            console.log('Tab clicked:', button.dataset.category);
            // Update active state
            newTabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Get category from the button's dataset
            const category = button.dataset.category || 'all';
            loadPhoneDirectory(category, searchInput.value);
        });
    });

    // Handle search input with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            const activeTab = document.querySelector('.tab-button.active');
            const category = activeTab ? activeTab.dataset.category || 'all' : 'all';
            loadPhoneDirectory(category, e.target.value);
        }, 300);
    });
}

// Update loadPhoneDirectory function
async function loadPhoneDirectory(category = 'all', searchTerm = '') {
    console.log('Loading phone directory - Category:', category, 'Search:', searchTerm);
    
    try {
        const authToken = sessionStorage.getItem('authToken');
        if (!authToken) {
            console.log('No auth token found, skipping phone directory load');
            return;
        }

        // Construct the API URL with query parameters
        let url = '/api/phone/contacts';
        const params = new URLSearchParams();
        if (category && category !== 'all') {
            params.append('category', category);
        }
        if (searchTerm) {
            params.append('search', searchTerm);
        }
        if (params.toString()) {
            url += '?' + params.toString();
        }

        console.log('Fetching contacts from:', url);
        const response = await fetch(url, {
            headers: {
                'Authorization': 'Basic ' + authToken
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contacts = await response.json();
        console.log('Received contacts:', contacts.length);
        updatePhoneGrids(contacts, category);
    } catch (error) {
        console.error('Error loading phone directory:', error);
        // Only show error message if we're on the phone directory page
        const phoneDirectory = document.querySelector('.phone-directory');
        if (phoneDirectory && phoneDirectory.closest('.page.active')) {
            document.querySelectorAll('.phone-grid').forEach(grid => {
                grid.innerHTML = '<div class="error-message">Error loading contacts. Please try again later.</div>';
            });
        }
    }
}

function createPhoneCard(contact) {
    return `
        <div class="phone-card">
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-role">${contact.role}</div>
                ${contact.email ? `<div class="contact-email">${contact.email}</div>` : ''}
            </div>
            <div class="contact-numbers">
                <div class="phone-number">${contact.phone_number}</div>
                ${contact.pager_number ? `<div class="pager-number">Pager: ${contact.pager_number}</div>` : ''}
            </div>
        </div>
    `;
}

// Update the login function to initialize phone directory after successful login
async function login() {
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('error-message');
    
    try {
        const response = await fetch('/verify', {
            headers: {
                'Authorization': 'Basic ' + btoa(':' + password)
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('login-container').classList.add('hidden');
            document.getElementById('main-content').classList.remove('hidden');
            // Store login state and password
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('authToken', btoa(':' + password));
            // Load initial schedule after successful login
            loadAllSchedules();
            // Initialize phone directory after successful login
            initializePhoneDirectory();
            // Clear any error messages
            if (errorMessage) {
                errorMessage.textContent = '';
                errorMessage.classList.remove('error');
            }
        } else {
            if (errorMessage) {
                errorMessage.textContent = 'Incorrect password';
                errorMessage.classList.add('error');
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        if (errorMessage) {
            if (error.message === 'Failed to fetch') {
                errorMessage.textContent = 'Unable to connect to server. Please ensure the server is running and try again.';
            } else {
                errorMessage.textContent = 'An error occurred. Please try again.';
            }
            errorMessage.classList.add('error');
        }
    }
}

// Update the window.onload function
window.onload = async function() {
    const loginContainer = document.getElementById('login-container');
    const mainContent = document.getElementById('main-content');
    const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
    const authToken = sessionStorage.getItem('authToken');
    const errorMessage = document.getElementById('error-message');
    
    if (isLoggedIn && authToken) {
        // Verify the stored token
        try {
            const response = await fetch('/verify', {
                headers: {
                    'Authorization': 'Basic ' + authToken
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                loginContainer.classList.add('hidden');
                mainContent.classList.remove('hidden');
                // Load initial schedule after verifying stored token
                loadAllSchedules();
                // Initialize phone directory after verifying token
                initializePhoneDirectory();
            } else {
                // Token is invalid, clear storage and show login
                sessionStorage.removeItem('isLoggedIn');
                sessionStorage.removeItem('authToken');
                loginContainer.classList.remove('hidden');
                mainContent.classList.add('hidden');
                if (errorMessage) {
                    errorMessage.textContent = 'Session expired. Please log in again.';
                    errorMessage.classList.add('error');
                }
            }
        } catch (error) {
            console.error('Error verifying token:', error);
            // Clear session storage
            sessionStorage.removeItem('isLoggedIn');
            sessionStorage.removeItem('authToken');
            
            loginContainer.classList.remove('hidden');
            mainContent.classList.add('hidden');
            
            if (errorMessage) {
                if (error.message === 'Failed to fetch') {
                    errorMessage.textContent = 'Unable to connect to server. Please ensure the server is running and refresh the page.';
                } else {
                    errorMessage.textContent = 'Session expired. Please log in again.';
                }
                errorMessage.classList.add('error');
            }
        }
    } else {
        loginContainer.classList.remove('hidden');
        mainContent.classList.add('hidden');
    }

    // Handle enter key press
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                login();
            }
        });
    }
}; 