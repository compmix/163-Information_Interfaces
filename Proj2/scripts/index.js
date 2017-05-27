var width = 500//window.innerWidth - 400;
var height = 500//window.innerHeight - 200;

var x = d3.scaleBand().rangeRound([0, width]).padding(0.1);
    x.domain([0, 5]);

var raw;
var text_by_episode;
var count_by_episode;

var episodes_per_season;
var running_episode_count = [0];

var list_characters; // [character] = [{character}, ...]
var references_by_episode; // [season][episode][character] = [{character : #refs}, ...]

var word_Cloud;
var chord_diagram;

var chord_size = 10;


// runs once the data is loaded
d3.csv('data/All-seasons.csv', function(rawData){
    // do something with the data here
    
    raw = rawData;
    
    word_Cloud = makeWordCloud("#wordcloud");
    chord_diagram = makeChord();
    
    text_by_episode = textByEpisode();
    count_by_episode = wordCountByEpisode(text_by_episode);
    
    makeTimeline(count_by_episode);
    
    
    update([]);
})



// take in an episode# and return [season, ep]
function episodeToSeason(episode) {
    var cur_season, cur_episode;
    
    for(cur_season = 1; cur_season < episodes_per_season.length; cur_season++) {
        if(episode <= running_episode_count[cur_season]) {
            cur_episode = episode - running_episode_count[cur_season - 1];
            break;
        }
    }
    
    return [cur_season, cur_episode];
}


// taken from https://stackoverflow.com/questions/5199901/how-to-sort-an-associative-array-by-its-values-in-javascript
function getSortedKeys(obj) {
    var keys = [];
    for(var key in obj)
        keys.push(key);
    return keys.sort(function(a,b){return obj[b]-obj[a]});
}

function makeTimeline(count_by_episode) {
    var width = 1000;
    var height = 300;
    
    var seasons = count_by_episode;
    var data = [];
    
    for(var cur_season = 1; cur_season < seasons.length; cur_season++) {
        for(var cur_episode = 1; cur_episode < seasons[cur_season].length; cur_episode++) {
            data.push(seasons[cur_season][cur_episode]);
        }
    }
    
    //number of tickmarks to use
    var num_ticks = 5;

    //margins
    var left_margin = 60;
    var right_margin = 60;
    var top_margin = 30;
    var bottom_margin = 0;
    
    var color = function(id) { return '#00b3dc' };
    
    var data_max = d3.max(data, function(d) {return d;} );
    
    var x = d3.scaleLinear()
        .domain([0, data.length])
        .range([0, width]);
    var y = d3.scaleLinear()
        .domain([data_max/3, data_max])
        .range([0, height - top_margin]);
    
    var y2 = d3.scaleLinear()
        .domain([data_max/3, data_max])
        .range([height - top_margin, 0]);
    
    
    var svg = d3.select("#timeline")
            .append("svg")
                .attr("width", width + 50)
                .attr("height", height + 25)
            .append("g")
                .attr("id", "barchart");
    
    svg.append("g")
      .attr("class", "axis axis--x")
      .attr("transform", "translate(" + left_margin + "," + height + ")")
      .call(d3.axisBottom(x));
    
    svg.append("g")
      .attr("class", "axis axis--y")
      .attr("transform", "translate(" + left_margin + "," + top_margin + ")")
      .call(d3.axisLeft(y2).ticks(10))
    .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 6)
      .attr("dy", ".71em")
      .style("text-anchor", "end")
      .text("Value ($)");
    
    var bar = svg.selectAll("g.bar")
            .data(data)
            .enter()
            .append("g")
            .attr("class", "bar");
    
    bar.append("rect")
        .attr("x", function(d,i) {
            return i * (width/data.length) + left_margin;
            })
        .attr("y", function(d) {
                return height - y(d);
            })
        .attr("width", width/data.length - 3 )
        .attr("height", function(d) {
            return y(d);
            })
        .attr("fill", color(0))
        .attr("class", "bar")
        .attr("id", function(d,i) {
            return i;
            })
        .attr("stroke", color(0));
    

    // set draggable element
    var brush = d3.brushX()
      .on("start", brushstart)
      .on("brush", brushmove)
      .on("end", brushend);
    
    
    
    bar.call(brush);
    
    //brush.move(bar, [0,1000]);
    
    
    // Clear the previously-active brush, if any.
    function brushstart() {
        //console.log("start");
    }
    
    function brushmove() {
        var selected = d3.event.selection;
        //console.log(selected);
        
        svg.selectAll("g.bar rect.bar")
            .classed("fade", function(d, i) {
            var bar_x = d3.select(this).attr("x");

            return selected[0] > bar_x || selected[1] < bar_x;
            })
    }
    
    function brushend(p, i, x) {
        var selected = d3.event.selection;
        
        var selection = [];
        
        svg.selectAll("g.bar rect.bar")
            .each(function(d, i){
                var bar_x = d3.select(this).attr("x");

                if(bar_x > selected[0] && bar_x < selected[1])
                    selection.push(d3.select(this).attr("id"));
             });
        
        console.log(selection);
        
        update(selection);
    }           
}

// take list of characters, return chord matrix
function referencedCharacters(selection) {
    var refs = references_by_episode;
    
    var selected_refs = {};
    var count_refs = {};
    
    // start with selection
    for(var i = 0; i < selection.length; i++) {
        var season_ep = episodeToSeason(selection[i]);
        var cur_season = season_ep[0];
        var cur_episode = season_ep[1];
        
        // populate selected_refs
        for(var character in refs[cur_season][cur_episode]) {
            var num_refs = Object.keys(refs[cur_season][cur_episode][character]).length;
            
            // skip characters that don't reference anyone
            if(num_refs == 0) continue;
            
            if( !(character in selected_refs) )
                selected_refs[character] = {};
            
            // add and increment existing ones
            for(var ref in refs[cur_season][cur_episode][character]) {
                if( ref in selected_refs[character] )
                    selected_refs[character][ref] += refs[cur_season][cur_episode][character][ref];
                else
                    selected_refs[character][ref] = refs[cur_season][cur_episode][character][ref];

                if( ref in count_refs )
                    count_refs[ref] += refs[cur_season][cur_episode][character][ref];
                else
                    count_refs[ref] = refs[cur_season][cur_episode][character][ref];
            }
        } 
    } // for selection
    
    
    // sort by most referenced people
    var sorted_refs = getSortedKeys(count_refs);
    
    //console.log("selected_refs", selected_refs);
    //console.log("sorted_refs", sorted_refs);
    //console.log("count_refs", count_refs);
    
    var matrix = [];
    var names = [];
    
    for(var row = 0; row < chord_size; row++) {
        var cur_char = sorted_refs[row];
        matrix.push([]);
        names.push(cur_char);
        
        for(var col = 0; col < chord_size; col++ ) {
            var ref_char = sorted_refs[col];
            
            if(cur_char in selected_refs && ref_char in selected_refs[cur_char])
                matrix[row].push(selected_refs[cur_char][ref_char]);
            else
                matrix[row].push(0);

        }
    }

    //console.log(matrix);
        
    // use selected_refs to create the chord matrix
    
    //console.log("selected_refs", selected_refs);
    //console.log("sorted_refs", sorted_refs);
    //console.log("count_refs", count_refs);
    
    chord_diagram.update(matrix, names);
    
    return;
}


function update(selection) {
    if(selection.length == 0) {
        // for empty selection, select all
        
        for (var i = 0; i < 257; i++ ) {
            selection[i] = i;
        }
    }

    var selected_text = "";
    
    for(var i = 0; i < selection.length; i++) {
        var season_episode = episodeToSeason( selection[i] );
        selected_text += text_by_episode[season_episode[0]][season_episode[1]];  
    }
    
    //console.log("selected_text", selected_text);
    
    var selected_entries = wordEntries(selected_text, true, 500);
    
    //console.log("selected_entries", selected_entries);
    word_Cloud.update(selected_entries);
    
    
    referencedCharacters(selection);
}


// returns seasons[season][episode] = count_words_in_episode;
function wordCountByEpisode(text_seasons) {
    var count = [];
    // seasons is a 2d array with text per episode per season
    
    // initialize count arrays
    for(var cur_season = 1; cur_season < text_seasons.length; cur_season++) {
            count[cur_season] = [];
    }
    
    for(var cur_season = 1; cur_season < text_seasons.length; cur_season++) {
        for(var cur_episode = 1; cur_episode < text_seasons[cur_season].length; cur_episode++) {
            
            var words = text_seasons[cur_season][cur_episode];
            words.split(/[ '\-\(\)\*":;\[\]|{},.!?\n]+/);
            
            count[cur_season][cur_episode] = words.length;
        }
    }
    
    //console.log("count_by_episode", count);
    return count;
}

// returns seasons[season][episode] = "text in episode";
function textByEpisode() {
    var seasons = [];
    var c_seasons = [];
    
    var characters = {};
    var ref_seasons = [];
    
    // initialize arrays
    for(var i = 1; i < 19; i++) {
        seasons[i] = [];
        c_seasons[i] = [];
        ref_seasons[i] = [];
    }
    // initialize internal arrays
    for(var i = 0; i < raw.length; i++) {
        if(raw[i].Season == "Season") continue;
        
        var cur_season = parseInt(raw[i].Season);
        var cur_episode = parseInt(raw[i].Episode);
        
        seasons[cur_season][cur_episode] = "";
        ref_seasons[cur_season][cur_episode] = {};
    }
    
    // go through every line and fill up corresponding data
    for(var i = 0; i < raw.length; i++) {
        if(raw[i].Season == "Season") continue;
        
        // fill out text_per_episode
        var cur_season = parseInt(raw[i].Season);
        var cur_episode = parseInt(raw[i].Episode);
        var cur_character = raw[i].Character;
        seasons[cur_season][cur_episode] += raw[i].Line;
        
        //save episodes per season;
        if(c_seasons[cur_season] < cur_episode)
           c_seasons[cur_season] = cur_episode;
        
        // store list of characters
        if( !(cur_character in characters) )
            characters[raw[i].Character] = {};
        
        if( !(cur_character in ref_seasons[cur_season][cur_episode]) )
            ref_seasons[cur_season][cur_episode][cur_character] = {};
    }
    
    // store references_by_episode
    for(var i = 0; i < raw.length; i++) {
        if(raw[i].Season == "Season") continue;
        
        var cur_season = parseInt(raw[i].Season);
        var cur_episode = parseInt(raw[i].Episode);
        var cur_character = raw[i].Character;
            
        var cur_text = raw[i].Line.split(/[ '\-\(\)\*":;\[\]|{},.!?\n]+/);
        
        // create an array for current character
        
        for(var word = 0; word < cur_text.length; word++) {
            
            if( !(cur_text[word] in characters) ) continue; // skip non-character names
            if( cur_text[word] == "watch" ) continue; // skip "watch" because it's a function
            
            // add the reference to ref_seasons[cur_season][cur_episode][cur_character] = [{name, value}]
            // cur_text[word] is the referenced character
    
            // if doesn't exist, add it to references_by_episode
            if(ref_seasons[cur_season][cur_episode][cur_character][cur_text[word]] == undefined) 
                ref_seasons[cur_season][cur_episode][cur_character][cur_text[word]] = 1;
            else
                ref_seasons[cur_season][cur_episode][cur_character][cur_text[word]] += 1;

        } // for each word
    } // for each line
    
    list_characters = characters;
    episodes_per_season = c_seasons;
    references_by_episode = ref_seasons;
    
    // store the running count of episodes per seasons
    for(var cur_season = 1; cur_season < episodes_per_season.length; cur_season++) {
        running_episode_count[cur_season] = episodes_per_season[cur_season] + running_episode_count[cur_season - 1];
    }
    

    //console.log("list_characters", characters);
    //console.log("references_by_episode", ref_seasons);
    //console.log("episodes_per_season", episodes_per_season);
    //console.log("running_episode_count", running_episode_count);
    //console.log("text_by_episode", seasons);
    
    return seasons;
}


function wordEntries(text_string, sorted, max_entries) {
    
    var common = "i,me,my,myself,we,us,oh,our,ours,ourselves,you,your,yours,yourself,yourselves,he,him,his,himself,she,her,hers,herself,it,its,itself,they,them,their,theirs,themselves,what,which,who,whom,whose,this,that,these,those,am,is,are,was,were,be,been,being,have,has,had,having,do,does,did,doing,will,would,should,can,could,ought,i'm,you're,he's,she's,it's,we're,they're,i've,you've,we've,they've,i'd,you'd,he'd,she'd,we'd,they'd,i'll,you'll,he'll,she'll,we'll,they'll,isn't,aren't,wasn't,weren't,hasn't,haven't,hadn't,doesn't,don't,didn't,won't,wouldn't,shan't,shouldn't,can't,cannot,couldn't,mustn't,let's,that's,who's,what's,here's,there's,when's,where's,why's,how's,a,an,the,and,but,if,or,because,as,until,while,of,at,by,for,with,about,against,between,into,through,during,before,after,above,below,to,from,up,upon,down,in,out,on,off,over,under,again,further,then,once,here,there,when,where,why,how,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,say,says,said,shall,yeah,well,like,get,just,know,okay,right,go,one,guys,gonna,see,come";

    var word_count = {};

    var words = text_string.split(/[ '\-\(\)\*":;\[\]|{},.!?\n]+/);
    if (words.length == 1){
        word_count[words[0]] = 1;
    } else {
        words.forEach(function(word){
      var word = word.toLowerCase();
      if (word != "" && common.indexOf(word)==-1 && word.length>1){
        if (word_count[word]){
          word_count[word]++;
        } else {
          word_count[word] = 1;
        }
      }
    })
    }

    var word_entries = d3.entries(word_count);
    
    if (sorted == true)
        word_entries.sort(function(a,b){return b["value"]-a["value"]});    
    
    word_entries = word_entries.slice(0, max_entries);
    
    return word_entries;
}


function makeChord() {
    var outerRadius = (width + 100) / 2,
    innerRadius = outerRadius - 130;

    var fill = d3.scaleOrdinal(d3.schemeCategory20c);

    
    var arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(innerRadius + 20);

    
    return {
        update: function (matrix, name) {
            document.getElementById("chord").innerHTML = "This chord diagram shows the top 10 referenced characters and who they referenced.";
            
            var svg = d3.select("#chord").append("svg")
        .attr("width", outerRadius * 2)
        .attr("height", outerRadius * 2)
      .append("g")
        .attr("transform", "translate(" + outerRadius + "," + outerRadius + ")");
            
            
            var indexByName = d3.map(),
            nameByIndex = d3.map(),
            n = 0;

            // Compute a unique index for each package name.
            name.forEach(function(d) {
                nameByIndex.set(n, d);
                indexByName.set(d, n++);
            });

            var chord = d3.chord()
                .padAngle(.04)
                .sortSubgroups(d3.descending)
                .sortChords(d3.descending);
            
            chord = chord(matrix);
            
            var g = svg.selectAll(".group")
                .data(chord.groups)
                .enter()
                .append("g")
                .attr("class", "group");

            g.append("path")
                .style("fill", function(d) { return fill(d.index); })
                .style("stroke", function(d) { return fill(d.index); })
                .attr("d", arc);

            g.append("text")
                .each(function(d) { d.angle = (d.startAngle + d.endAngle) / 2; })
                .attr("dy", ".35em")
                .attr("transform", function(d) {
                    return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
                        + "translate(" + (innerRadius + 26) + ")"
                        + (d.angle > Math.PI ? "rotate(180)" : "");
                    })
                .style("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
                .text(function(d) { return nameByIndex.get(d.index); });

            svg.selectAll(".chord")
                .data(chord)
                .enter().append("path")
                .attr("class", "chord")
                .style("stroke", function(d) { return d3.rgb(fill(d.source.index)).darker(); })
                .style("fill", function(d) { return fill(d.source.index); })
                .attr("d", d3.ribbon().radius(innerRadius));
            
            
            d3.select(self.frameElement).style("height", outerRadius * 2 + "px");
        }
    }
    
}


// using https://bl.ocks.org/blockspring/847a40e23f68d6d7e8b5
// using https://github.com/jasondavies/d3-cloud
function makeWordCloud(selector) {
    
    var fill = d3.scaleOrdinal(d3.schemeCategory20);

    var svg = d3.select(selector).append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", "translate(" + [width >> 1, height >> 1] +       ")");

    
    function draw(words) {
      var xScale = d3.scaleLinear()
            .domain([0, d3.max(words, function(d) {
                return d.value;
                })
            ])
            .range([10,100]);
        
    
      
      var cloud = svg.selectAll("g text")
            .data(words, function(d){return d.key});
        
        cloud.enter()
            .append("text")
            .style("font-size", function(d) { return xScale(d.value) + "px"; })
            .style("font-family", "Impact")
            .style("fill", function(d, i) { return fill(i); })
            .attr("text-anchor", "middle")
            .attr("transform", function(d) {
                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .text(function(d) { return d.key; });
        
        cloud.transition()
            .duration(600)
            .style("font-size", function(d) { return xScale(d.value) + "px"; })
            .attr("transform", function(d) {
                return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .style("fill-opacity", 1);
        
        cloud.exit()
            .transition()
            .duration(200)
            .style('fill-opacity', 1e-6)
            .attr('font-size', 1)
            .remove();
    }

    //d3.layout.cloud().stop();

    
    return {
        update: function(words) {
            var xScale = d3.scaleLinear()
               .domain([0, d3.max(words, function(d) {
                  return d.value;
                })
               ])
               .range([10,100]);
            
            d3.layout.cloud()
                .size([width,height])
                .timeInterval(20)
                .words(words)
                .padding(5)
                .rotate(function() { return ~~(Math.random() * 2) * 90; })
                .font("Impact")
                .text(function(d) { return d.key; })
                .fontSize(function(d) { return xScale(+d.value); })
                .on("end", draw)
                .start();
        }
    }
    
}

// 1. shared words between seasons
// 2. word cloud
// 3. timeline that can be highlighted