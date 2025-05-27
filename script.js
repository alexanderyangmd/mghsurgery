// Track the currently displayed date globally
let currentDisplayDate = new Date();
// Set year to current year since future schedules don't exist
currentDisplayDate.setFullYear(new Date().getFullYear());

document.addEventListener('DOMContentLoaded', function() {
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
                
                // Fetch both schedules
                Promise.all([
                    fetchAmionData(currentDisplayDate),
                    fetchChurchillData(currentDisplayDate)
                ]).then(([teams, churchillAttendings]) => {
                    updateScheduleDisplay(teams || {});
                    updateChurchillAttendingDisplay(churchillAttendings);
                }).catch(error => {
                    console.error('Error fetching schedules:', error);
                    updateScheduleDisplay({});
                    updateChurchillAttendingDisplay(null);
                });
            });
        });
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

    // Phone Directory Functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const phoneGrids = document.querySelectorAll('.phone-grid');
    
    // Sample data structure for phone numbers
    const phoneDirectory = {
        attending: [
            { name: 'Dr. Smith', role: 'Chief of Surgery', number: '617-555-0101' },
            { name: 'Dr. Johnson', role: 'Trauma Surgery', number: '617-555-0102' },
            // Add more attending numbers...
        ],
        resident: [
            { name: 'Dr. Brown', role: 'Chief Resident', number: '617-555-0201' },
            { name: 'Dr. Davis', role: 'PGY-4', number: '617-555-0202' },
            // Add more resident numbers...
        ],
        app: [
            { name: 'Jane Smith', role: 'Surgical APP', number: '617-555-0251' },
            { name: 'John Doe', role: 'Trauma APP', number: '617-555-0252' },
            // Add more APP numbers...
        ],
        other: [
            { name: 'OR Front Desk', role: 'Main Line', number: '617-555-0301' },
            { name: 'PACU', role: 'Nurse Station', number: '617-555-0302' },
            // Add more important numbers...
        ]
    };

    // Function to create phone card
    function createPhoneCard(contact) {
        return `
            <div class="phone-card">
                <div class="contact-info">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-role">${contact.role}</div>
                </div>
                <div class="phone-number">${contact.number}</div>
            </div>
        `;
    }

    // Function to update phone grids
    function updatePhoneGrids(category = 'all') {
        Object.entries(phoneDirectory).forEach(([key, contacts]) => {
            const grid = document.querySelector(`#${key}-numbers .phone-grid`);
            
            if (category === 'all' || category === key) {
                grid.innerHTML = contacts
                    .map(contact => createPhoneCard(contact))
                    .join('');
                document.getElementById(`${key}-numbers`).style.display = 'block';
            } else {
                document.getElementById(`${key}-numbers`).style.display = 'none';
            }
        });
    }

    // Initialize phone grids
    updatePhoneGrids();

    // Handle category tab clicks
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updatePhoneGrids(button.dataset.category);
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
    
    // Fetch both schedules
    Promise.all([
        fetchAmionData(currentDisplayDate),
        fetchChurchillData(currentDisplayDate)
    ]).then(([teams, churchillAttendings]) => {
        updateScheduleDisplay(teams || {});
        updateChurchillAttendingDisplay(churchillAttendings);
    }).catch(error => {
        console.error('Error fetching schedules:', error);
        updateScheduleDisplay({});
        updateChurchillAttendingDisplay(null);
    });
}

async function fetchAmionData(date) {
    try {
        // Format the date parameters
        const day = date.getDate();
        const month = date.getMonth() + 1; // getMonth() returns 0-11
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
        pancreatitis: null
    };
    
    // Skip header lines
    const dataLines = lines.slice(5);
    
    dataLines.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 4) return;
        
        const [name, , , role] = parts.map(p => p.replace(/"/g, '').trim());
        
        // Match roles to their respective positions
        if (role === 'Churchill Day') {
            attendings.day = name;
        } else if (role === 'Churchill Night') {
            attendings.night = name;
        } else if (role === 'Backup') {
            attendings.backup = name;
        } else if (role === 'Pancreatitis') {
            attendings.pancreatitis = name;
        }
    });
    
    console.log('Parsed Churchill attendings:', attendings);
    return attendings;
}

function updateChurchillAttendingDisplay(attendings) {
    if (!attendings) {
        const placeholderText = 'Not Available';
        document.getElementById('churchill-day-attending').textContent = placeholderText;
        document.getElementById('churchill-night-attending').textContent = placeholderText;
        document.getElementById('churchill-backup').textContent = placeholderText;
        document.getElementById('churchill-pancreatitis').textContent = placeholderText;
        return;
    }

    document.getElementById('churchill-day-attending').textContent = attendings.day || 'Not Available';
    document.getElementById('churchill-night-attending').textContent = attendings.night || 'Not Available';
    document.getElementById('churchill-backup').textContent = attendings.backup || 'Not Available';
    document.getElementById('churchill-pancreatitis').textContent = attendings.pancreatitis || 'Not Available';
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
    const unavailableMessage = document.getElementById('schedule-unavailable');
    const pitTeamSection = document.getElementById('pit-team-section');
    const bakerTeamSection = document.getElementById('baker-team-section');
    const churchillTeamSection = document.getElementById('churchill-team-section');
    const thoracicsTeamSection = document.getElementById('thoracics-section');
    const vascularTeamSection = document.getElementById('vascular-section');
    
    if (!pitSection || !bakerSection || !churchillSection || !thoracicsSection || !vascularSection || !unavailableMessage || 
        !pitTeamSection || !bakerTeamSection || !churchillTeamSection || !thoracicsTeamSection || !vascularTeamSection) {
        console.error('Could not find required containers');
        return;
    }

    // If no teams data or empty teams object
    if (!teams || Object.keys(teams).length === 0) {
        // Show unavailable message and hide team sections
        unavailableMessage.style.display = 'flex';
        pitTeamSection.style.display = 'none';
        bakerTeamSection.style.display = 'none';
        churchillTeamSection.style.display = 'none';
        thoracicsTeamSection.style.display = 'none';
        vascularTeamSection.style.display = 'none';
        return;
    }

    // Hide unavailable message and show team sections
    unavailableMessage.style.display = 'none';
    pitTeamSection.style.display = 'block';
    bakerTeamSection.style.display = 'block';
    churchillTeamSection.style.display = 'block';
    thoracicsTeamSection.style.display = 'block';
    vascularTeamSection.style.display = 'block';

    // Clear existing content
    pitSection.innerHTML = '';
    bakerSection.innerHTML = '';
    churchillSection.innerHTML = '';
    thoracicsSection.innerHTML = '';
    vascularSection.innerHTML = '';

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