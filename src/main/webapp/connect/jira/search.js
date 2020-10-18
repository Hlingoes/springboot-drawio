//Parses URL parameters
function getUrlParam(param)
{
	var result = (new RegExp(param + '=([^&]*)')).exec(window.location.search);
	
	if (result != null && result.length > 0)
	{
		return decodeURIComponent(result[1].replace(/\+/g, '%20'))
	}
	
	return null;
};

function getBaseUrl()
{
	var baseUrl = getUrlParam('xdm_e', true) + getUrlParam('cp', true);
	//Ensure baseUrl belongs to attlasian (*.jira.com and *.atlassian.net)
	//Since we add cp to xdm_e, we had to ensure that there is a slash after the domain. Since if xdm_e is ok, cp can corrupt is such as cp = '.fakedomain.com' such that baseUrl is atlassian.net.fakedomain.com
	if (/^https:\/\/([^\.])+\.jira\.com\//.test(baseUrl + '/') || /^https:\/\/([^\.])+\.atlassian\.net\//.test(baseUrl + '/')) 
	{
		return baseUrl;
	}
	throw 'Invalid baseUrl!';
};

(function()
{
	// Specifies connection mode for touch devices (at least one should be true)
	var baseUrl = getBaseUrl();
	var connectUrl = baseUrl + '/atlassian-connect';
	var head = document.getElementsByTagName("head")[0];
	
	var script = document.createElement("script");
	script.setAttribute('data-options', 'resize:false;margin:false');

	head.appendChild(script);
	
	var link = document.createElement("link");
	link.type = "text/css";
	link.rel = "stylesheet";
	link.href = connectUrl + '/all.css';
	head.appendChild(link);
	script.onload = main;
	script.src = 'https://connect-cdn.atl-paas.net/all.js';
	
	function htmlEntities(s, newline)
	{
		s = String(s || '');
		
		s = s.replace(/&/g,'&amp;'); // 38 26
		s = s.replace(/"/g,'&quot;'); // 34 22
		s = s.replace(/\'/g,'&#39;'); // 39 27
		s = s.replace(/</g,'&lt;'); // 60 3C
		s = s.replace(/>/g,'&gt;'); // 62 3E

		if (newline == null || newline)
		{
			s = s.replace(/\n/g, '&#xa;');
		}
		
		return s;
	};
	
	function attachButtonEvents(issueId, diagramName, diagramId, diagramDate, openBtn, editBtn, searchTxt)
	{
		openBtn.addEventListener('click', function()
		{
			AP.dialog.create(
			{
               header: diagramName + ' (' + diagramDate + ')',
			   key: 'drawioFullScreenViewer',
               size: 'fullscreen',
			   chrome: true,
			   customData: {diagramName: diagramName, diagramId: diagramId}
			});
		});
		
		editBtn.addEventListener('click', function()
		{
			AP.dialog.create(
			{
			   key: 'drawioEditor',
			   width: '100%',
			   height: '100%',
			   chrome: false,
			   customData : {issueId: issueId, diagramName: diagramName, diagramId: diagramId}
			}).on("close", function()
			{
				doSearch(searchTxt);
			});
		});
	};
	
	function createIssueDiagramsRows(issue, grid, isAlt, searchTxt)
	{
		var props = issue.properties["drawio-metadata"];		
		var isFirst = true;
		
		for (var i = 0; i < props.name.length; i++)
		{
			if (searchTxt != null && searchTxt.length > 0)
			{
				var searchTest = new RegExp(searchTxt, "i");
				//do per diagram filtering
				if (!searchTest.test(props.name[i]) && !searchTest.test(props.txtContent[i]))
					continue;
			}
			var row = document.createElement('tr');
			row.className = isAlt? "gridRowAlt" : "gridRow";
			var td = document.createElement('td');
			td.className = "gridRowCell";
			td.innerHTML = isFirst? ("<a href='" + baseUrl + "/browse/" + issue.key + "' target='_blank'>"+ htmlEntities(issue.key) + "</a>"): "";
			row.appendChild(td);
			td = document.createElement('td');
			td.className = "gridRowCell";
			var div =  document.createElement('div');
			var span = document.createElement('span');
			var modDate = new Date(props.updated[i]).toLocaleString();
			span.innerHTML = htmlEntities(props.name[i]) + " (" + modDate + ")";
			span.className = "diagramName";
			div.appendChild(span);
			var editBtn = document.createElement('button');
			editBtn.innerHTML = "Edit Diagram";
			editBtn.className = "aui-button btn";
			div.appendChild(editBtn);
			var openBtn = document.createElement('button');
			openBtn.innerHTML = "Open Diagram";
			openBtn.className = "aui-button btn";
			div.appendChild(openBtn);
			attachButtonEvents(issue.id, props.name[i], props.id[i], modDate, openBtn, editBtn, searchTxt);
			td.appendChild(div);
			row.appendChild(td);
			grid.appendChild(row);
			isFirst = false;
		};
	};
	
	function fillResults(issues, searchTxt)
	{
		var resultsPanel = document.getElementById("resultsPanel");
		resultsPanel.innerHTML = "";
		
		var grid = document.createElement('table');
		grid.style.whiteSpace = 'nowrap';
		grid.style.width = '100%';
		//create header row
		var hrow = document.createElement('tr');
		hrow.className = "gridHeader";
		var th = document.createElement('th');
		th.className = "gridHeaderCell";
		th.innerHTML = "Issue";
		hrow.appendChild(th);
		th = document.createElement('th');
		th.className = "gridHeaderCell";
		th.innerHTML = "Diagrams";
		hrow.appendChild(th);
		grid.appendChild(hrow)
		resultsPanel.appendChild(grid);
		
		var isAlt = false;
		
		if (issues.length == 0)
		{
			var emptyNote = document.createElement('div');
			emptyNote.innerHTML = "No diagrams found!";
			resultsPanel.appendChild(emptyNote);
		}
		else
		{
			for (var i = 0; i < issues.length; i++)
			{
				createIssueDiagramsRows(issues[i], grid, isAlt, searchTxt);
				isAlt = !isAlt;
			}
		}
	};
	
	var searchTxtInput = document.getElementById("searchTxt");
	
	document.getElementById("searchBtn").addEventListener('click', function()
	{ 
		doSearch();
	});
	
	searchTxtInput.addEventListener('keypress', function(e) 
	{
		if (e.keyCode == 13) 
		{
			doSearch();
		}
	});
	
	function doSearch(searchTxt)
	{
		searchTxt = searchTxt != null? searchTxt : searchTxtInput.value;
		
		var jql = "";
		
		if (searchTxt.length > 0)
		{
			jql = encodeURIComponent('diagramTextContent ~ "' + searchTxt.replace('"', '\"') + '*" OR diagramName ~ "' + searchTxt.replace('"', '\"') + '*"');
		}
		else
		{
			jql = "hasDiagram%3D1";
		}
		
		AP.request({
			url: '/rest/api/2/search?jql=' + jql + '&properties=drawio-metadata',
			type: 'GET',
			success: function(resp) 
			{
				resp = JSON.parse(resp);
				fillResults(resp.issues, searchTxt);
			},
			error: function() 
			{
				//TODO handle errors
			}
		});
	};
	
	function main()
	{
		AP.request({
			url: '/rest/api/2/search?jql=hasDiagram%3D1&properties=drawio-metadata',
			type: 'GET',
			success: function(resp) 
			{
				resp = JSON.parse(resp);
				fillResults(resp.issues);
			},
			error: function() 
			{
				//TODO handle errors
			}
		});
	};
	
})();
