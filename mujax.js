var util = require("util"),
    url = require("url"),
    fs = require("fs"),
    child_process = require('child_process'),
    http = require('http'),
    EventEmitter = require("events").EventEmitter;

var COUNT = 0

function Mujax(urls, callback, options){
    this.counter = 0;
    this.options = options || {}
    this.options.directory = this.options.directory || "/tmp/node"
    this.urls = urls || []
    if(typeof this.urls == "string"){
        this.urls = [this.urls];
    }
    this.callback = callback;
    
    var errors = [], waiting = urls.length, parts, filename, files = [];
    
    for(var i=0, len = urls.length; i<len; i++){
        parts = url.parse(urls[i]);
        filename = this.options.directory+"/"+ ((parts.pathname || "/").split("/").pop() || "untitled_"+(++COUNT)+".txt");
        files.push(filename)
        saveStreamToFile(urls[i], filename, function(err, success){
            waiting--;
            if(err){
                errors.push(err)
            }else if(success){
                
            }
            if(!waiting){
                if(errors.length){
                    for(var i=0, len = files.length; i<len; i++){
                        fs.unlink(files[i])
                    }
                    callback(errors, null)
                }else
                    callback(null, files);
            }
        });
    }
}


function saveStreamToFile(url, filename, callback){
    
    var f = fs.createWriteStream(filename);

    f.on("error", function(err){
        if(typeof err=="string")
            err = ["IO Error: "+err];
        else if(typeof err=="object")
            err = ["IO Error: "+(err.message||"?")];
        callback(err && err.length && err || ["IO Error"], null);
        fs.unlink(filename)
    });
    f.on("open", function(fd){
        var request = new EventEmitter(); 

        request.on("data", function(chunk){
            f.write(chunk)
        });
        request.on("end", function(){
            f.end();
            callback(null, true);
        });
        request.on("error", function(err){
            f.end();
            child_process.exec('rm '+filename);
            fs.unlink(filename);
            callback(err, null);
        });
        request.on("response", function(){});
        
        HTTPRequestEmitter(url, request);
    });
}

function HTTPRequestEmitter(request_url, ee, redir_count){
    var connection, request,
        parts = url.parse(request_url);
    
    redir_count = redir_count || 0;
    
    if(!parts.port){
        switch(parts.protocol){
            case "https":
                parts.port = 443;
                break;
            case "ftp":
                parts.port = 21;
                break;
            default:
                parts.port = 80;   
        }
    }
    
    parts.pathname = parts.pathname && parts.pathname.replace(/\s/g, "%20") || "/";

    connection = http.createClient(parts.port, parts.hostname);
    request = connection.request('GET', parts.pathname+(parts.search?parts.search:""), {'host': parts.hostname});
    request.end();
    
    connection.on("error", function(err){
        if(typeof err=="string")
            err = "Network Error: "+err;
        else if(typeof err=="object")
            err = "Network Error: "+(err.message||"?");
        ee.emit("error", (err || "Network Error")+" ("+parts.hostname+parts.pathname+")");
    });
    
    request.on("error", function(err){
        if(typeof err=="string")
            err = "Network Error: "+err;
        else if(typeof err=="object")
            err = "Network Error: "+(err.message||"?");
        ee.emit("error", (err || "Network Error")+" ("+parts.hostname+parts.pathname+")");
    });
    
    request.on("response", function(resp){
        ee.emit("response", resp);
        
        if((resp.statusCode == 301 || resp.statusCode == 302) && resp.headers.location){
            if(redir_count>10){
                ee.emit("error", "Network error: Too much recursion ("+parts.hostname+parts.pathname+")");
            }
            // redirect
            ee.emit("redirect", resp.headers.location);
            HTTPRequestEmitter(resp.headers.location, ee, ++redir_count);
            return;
        }
        
        if(resp.statusCode == 404) {
            ee.emit("error", "Network error: File not found "+resp.statusCode+" ("+parts.hostname+parts.pathname+")");
            return;
        }
        
        if(resp.statusCode == 500) {
            ee.emit("error", "Network error: Internal server error "+resp.statusCode+" ("+parts.hostname+parts.pathname+")");
            return;
        }
        
        if(resp.statusCode != 200) {
            ee.emit("error", "Network error: Invalid status code "+resp.statusCode+" ("+parts.hostname+parts.pathname+")");
            return;
        }
        resp.on("error", function(err){
            if(typeof err=="string")
                err = "Network Error: "+err;
            else if(typeof err=="object")
                err = "Network Error: "+(err.message||"?");
            ee.emit("error", (err || "Network Error")+" ("+parts.hostname+parts.pathname+")");
        });
        resp.on("data", function(chunk){
            ee.emit("data", chunk);
        });
        resp.on("end", function(){
            ee.emit("end");
        });
    });
    
    return ee;
}

function format_error(err, type){
    if(typeof err=="string")
        err = type+" Error: "+err;
    else if(typeof err=="object")
        err = type+" Error: "+(err.message||"?");
    if(!err || typeof err != "string")
        err = type;
    return err;
}
    
function openFileStream(filename, ee){
    
    var filesize = 0;
    
    fs.stat(filename, function(err, stats){
        if(err){
            ee.emit("error", format_error(err, "IO")+" ("+filename+")");
            return;
        }
        filesize = stats.size;
        if(!filesize){
            ee.emit("error", "IO Error: zero file size ("+filename+")");
            return;
        }
        
        ee.emit("info", filesize);
        var f = fs.createReadStream(filename);
        f.on("error", function(err){
            ee.emit("error", format_error(err, "IO")+" ("+filename+")");
            return;
        });
        f.on("data", function(chunk){
            ee.emit("data", chunk);
        });
        f.on("end", function(chunk){
            ee.emit("end");
        });
    });
}


function HTTPPostFile(request_url, options, callback){
    
    var filename = options.filename;
    
    fs.stat(filename, function(err, stats){
        if(err){
            callback(format_error(err, "IO")+" ("+filename+")");
            return;
        }
        if(!stats.size){
            callback("IO Error: zero file size ("+filename+")");
            return;
        }
    
        var filesize = stats.size,
            content_length = 0,
            fileLoader = new EventEmitter(),
            boundary = "------BOUNDARY"+Date.now(),
            connection, request,
            parts = url.parse(request_url),
            req_end = "\r\n--"+boundary+"--\r\n",
            req_str = "";
    
        if(!parts.port){
            switch(parts.protocol){
                case "https":
                    parts.port = 443;
                    break;
                case "ftp":
                    parts.port = 21;
                    break;
                default:
                    parts.port = 80;   
            }
        }
    
        parts.pathname = parts.pathname && parts.pathname.replace(/\s/g, "%20") || "/";

        // pane ülejäänud request kokku, et saaks suurust arvutada
        var field = "";
        if(options.fields){
            for(var i=0, len=options.fields.length; i<len; i++){
                field = "--"+boundary+"\r\n";
                field += 'Content-Disposition: form-data; name="'+options.fields[i].name+'"'+"\r\n";
                field += "\r\n";
                field += options.fields[i].value+"\r\n";
                req_str += field;
            }
        }

        field = "--"+boundary+"\r\n";
        field += 'Content-Disposition: form-data; name="'+options.field+'"; filename="'+options.name+'"'+"\r\n";
        field += 'Content-Type: '+(options.mime || "application/octet-stream")+"\r\n";
        field += "\r\n";
        req_str += field;

        content_length = req_str.length + filesize + req_end.length;
        
        connection = http.createClient(parts.port, parts.hostname);
        request = connection.request('POST', parts.pathname+(parts.search?parts.search:""), {
            'host': parts.hostname,
            'content-type': 'multipart/form-data; boundary='+boundary,
            'content-length': content_length
        });
        
        request.on("error", function(err){
            callback(format_error(err, "IO")+" ("+options.name+")");
        });
        request.write(req_str);
        request.on("response", function(resp){
            if(resp.statusCode>=400)
                callback("Upload error - response code "+resp.statusCode+" ("+options.name+")");
            else
                callback(null, "Upload OK");
            resp.on("data", function(chunk){});            
        });
        
        f = fs.createReadStream(options.filename);
        f.on("data", function(chunk){
            request.write(chunk);
        })

        f.on("end", function(){
            request.end(req_end);
        });
    
        f.on("error", function(err){
            callback(format_error(err, "IO")+" ("+options.name+")");
            request.destroy();
        });
    });
}

this.Mujax = Mujax;
this.HTTPPostFile = HTTPPostFile;
