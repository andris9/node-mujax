var mujax = require("./mujax");


var urls = [
"http://koljaku.appspot.com/generate-css/k12001_KREATA.css?key=agdrb2xqYWt1cnALEghTaXRlVXNlciJXPHVzZXItaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9hY2NvdW50cy9vOC9pZD9pZD1BSXRPYXdsd1FOOHBkMHU4b3FybXBfdHV0NlB2OFlORmpKV21SUlU-DAsSBEJvb2sY4V0M",
"http://koljaku.appspot.com/generate-guide/k12001_Guide.opf?key=agdrb2xqYWt1cnALEghTaXRlVXNlciJXPHVzZXItaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9hY2NvdW50cy9vOC9pZD9pZD1BSXRPYXdsd1FOOHBkMHU4b3FybXBfdHV0NlB2OFlORmpKV21SUlU-DAsSBEJvb2sY4V0M",
"http://koljaku.appspot.com/generate-cover/k12001_cover.jpg?key=agdrb2xqYWt1cnALEghTaXRlVXNlciJXPHVzZXItaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9hY2NvdW50cy9vOC9pZD9pZD1BSXRPYXdsd1FOOHBkMHU4b3FybXBfdHV0NlB2OFlORmpKV21SUlU-DAsSBEJvb2sY4V0M",
"http://koljaku.appspot.com/generate-item/k12001_toc.html?type=toc&book=agdrb2xqYWt1cnALEghTaXRlVXNlciJXPHVzZXItaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9hY2NvdW50cy9vOC9pZD9pZD1BSXRPYXdsd1FOOHBkMHU4b3FybXBfdHV0NlB2OFlORmpKV21SUlU-DAsSBEJvb2sY4V0M",
"http://koljaku.appspot.com/generate-item/k12001_chapter_15001.html?type=chapter&key=agdrb2xqYWt1cn4LEghTaXRlVXNlciJXPHVzZXItaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9hY2NvdW50cy9vOC9pZD9pZD1BSXRPYXdsd1FOOHBkMHU4b3FybXBfdHV0NlB2OFlORmpKV21SUlU-DAsSBEJvb2sY4V0MCxIHQ2hhcHRlchiZdQw"
];

new mujax.Mujax(urls, function(err, files){
    console.log(err)
    console.log(files)
    
    mujax.HTTPPostFile("http://dev.kreata.ee/receive.php",{
        "filename":"./k12001_KREATA.css",
        "name":"k12001_KREATA.css",
        "field": "upload",
        "mime": "text/css",
        "fields":[{
            "name":"test1",
            "value": "value1"
        }]
    },function(err, resp){
        console.log(err);
        console.log(resp);
    });
    
}, {directory: "."})

