var util = require("util"),
    url = require("url"),
    child_process = require('child_process'),
    Request = require("request"),
    fs = require("fs"),
    http = require('http'),
    mujax = require("./includes/mujax"),
    querystring = require("querystring");

this.handleRequest = function (request, response) {
    
    var post_body = "", payload;
    request.on("data", function(chunk){
        post_body += chunk.toString("utf-8");
    });
    
    request.on("end", function(){
        if(post_body.length){
            params = querystring.parse(post_body);
            try{
                payload = JSON.parse(params.data);
            }catch(E){}
        }
        if(!payload || !payload.files || !payload.files.length){
            showError(response, "Request error: Invalid data");
            return;
        }else
            showOK(response, "Queued");
        handleConversion(request, response, payload);
    });
};

function handleConversion(request, response, payload){
    new mujax.Mujax(payload.files, function(err, files){
        if(err){
            sendError(payload, "Download errors\n"+err.join(",\n"));
            return;
        }else
            doConversion(request, response, payload, files);
    }, {directory: "/tmp/node"});
}

function doConversion(request, response, payload, files){
    files.push('/tmp/node/'+payload.out);
    child_process.exec('kindlegen /tmp/node/'+payload.main+' -o '+payload.out,
        function (error, stdout, stderr) {
            var lines = String(stdout).trim().split("\n"),
                lastLine = lines.pop().toLowerCase();
            console.log(lines)
            console.log("L:"+lastLine)
            var status = "ERROR";
            if(lastLine.indexOf("successfully")>-1)
                status = "SUCCESS"
            else if(lastLine.indexOf("warnings")>-1)
                status = "WARNINGS"
            if (error !== null) {
                removeFiles(files);
                sendError(payload, "Conversion error")
            }else{
                payload.fields = payload.fields || [];
                payload.fields.push({name:"conversion_status", value:status});
                postBack(request, response, payload, files, status);
            }
        });
}

function removeFiles(files){
    for(var i=0, len=files.length; i<len; i++){
        fs.unlink(files[i]);
    }
}

function postBack(request, response, payload, files, status, repeat){
    repeat = repeat || 0;
    //
    mujax.HTTPPostFile(payload.postCallback,{
        "filename":'/tmp/node/'+payload.out,
        "name": payload.out,
        "field": "file",
        "mime": "application/x-mobipocket-ebook",
        "fields":payload.fields
    },function(error, resp){
        if (!error) {
            // OK!
            console.log("success")
            removeFiles(files);
        }else{
            repeat++;
            if(repeat>5){
                // stop trying
                console.log("stop repeating")
                removeFiles(files);
                sendError(payload, "Upload failed")
                return;
            }
            // try again
            console.log("repeat")
            setTimeout(function(){
                postBack(request, response, payload, files, status, repeat);
            }, repeat*1*60*1000)
        }
    });
}

function sendError(payload, message, repeat){
    repeat = repeat || 0;
    Request({uri:payload.errorCallback,
    method:"POST", headers:{'content-type':'application/x-www-form-urlencoded'}, body:querystring.stringify({message:message})},
        function (error, response, body) {
            if (!error && response.statusCode == 200) {
                // OK!
            }else{
                repeat++;
                if(repeat>5){
                    // stop trying
                    console.log("Stop error repeating")
                    return;
                }
                // try again
                console.log("Repeat error")
                setTimeout(function(){
                    sendError(payload, message, repeat);
                }, repeat*1*60*1000)
            }
        });
}

function showOK(response, message){
    response.writeHead(200, {"Content-Type": "text/plain; charset=utf-8"});
    response.write(message);
    response.end();
}

function showError(response, message){
    response.writeHead(500, {"Content-Type": "text/plain; charset=utf-8"});
    response.write("Error: " +message);
    response.end();
}