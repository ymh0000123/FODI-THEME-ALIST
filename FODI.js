function createCORSRequest(method, url, timeout) {
    let xhr = new XMLHttpRequest();

    // 检查浏览器是否支持CORS
    if ("withCredentials" in xhr) {
        // 支持CORS
        xhr.open(method, url, true);
    } else if (typeof XDomainRequest !== "undefined") {
        // IE 8/9 对CORS的支持
        xhr = new XDomainRequest();
        xhr.open(method, url);
    } else {
        // 不支持CORS
        xhr = null;
    }

    // 如果xhr对象有效，则设置超时时间
    if (xhr) {
        xhr.timeout = timeout;
    }

    return xhr;
}

function sendRequest(method, url, data, headers, callback, error, times) {
    let xhr = createCORSRequest(method, url, 2500);
    xhr.onreadystatechange = () => {
        if (xhr.readyState == 4 && xhr.status == 200) {
            callback(xhr.responseText);
        }
    };
    xhr.timeout = xhr.onerror = () => {
        if (!times) {
            times = 0;
        }
        console.log({
            url: url,
            data: data,
            times: times,
        });
        if (times < 1) {
            sendRequest(method, url, data, headers, callback, error, times + 1);
        } else if (typeof error === "function") {
            error();
        }
    };
    if (headers) {
        for (key in headers) {
            if (headers.hasOwnProperty(key)) {
                xhr.setRequestHeader(key, headers[key]);
            }
        }
    }
    if (data) {
        xhr.send(data);
    } else {
        xhr.send();
    }
}

function renderPage(data, cache) {
    let files;
    if (data) {
        files = JSON.parse(data);
        window.fileCache.set(files.parent, files);
        preCache(files, 0);
    } else {
        files = cache;
    }
    if (files.parent === window.backFordwardCache.current) {
        renderPath(files.parent);
        if (files.encrypted) {
            handleEncryptedFolder(files);
        } else {
            renderFileList(files);
        }
        renderTreeNode(files);
    }
    if (document.body.getAttribute("hidden")) {
        document.body.removeAttribute("hidden");
    }
    document.querySelector(".loading-wrapper").style.display = "none";
}

function renderPath(path) {
    const createPathSpan = (text, path) => {
        let pathSpan = document.createElement("span");
        pathSpan.innerHTML =
            text.length > 20 ? text.substring(0, 20) + ".." : text;
        pathSpan.className = text === "/" ? "nav-arr" : "nav-path";
        if (path) {
            addPathListener(pathSpan, path);
        }
        return pathSpan;
    };

    const paths = path.split("/");
    let pathSpanWrapper = document.getElementById("path");
    pathSpanWrapper.innerHTML = "";
    pathSpanWrapper.appendChild(createPathSpan(window.api.root));
    let continualPath = "/";
    for (let i = 1; i < paths.length - 1; i++) {
        continualPath += paths[i];
        pathSpanWrapper.appendChild(createPathSpan(paths[i], continualPath));
        pathSpanWrapper.appendChild(createPathSpan("/"));
        continualPath += "/";
    }
    pathSpanWrapper.appendChild(createPathSpan(paths[paths.length - 1]));
}

function renderFileList(files) {
    switchRightDisplay();

    const createFileWrapper = (type, name, time, size, path, url) => {
        let fileWrapper = document
            .getElementById("file-wrapper-templete")
            .content.cloneNode(true);
        fileWrapper.querySelector("ion-icon").setAttribute("name", type);
        fileWrapper.querySelector(".name").innerHTML = name;
        fileWrapper.querySelector(".time").innerHTML = time;
        fileWrapper.querySelector(".size").innerHTML = size;
        addFileListLineListener(
            fileWrapper.querySelector(".row.file-wrapper"),
            path,
            url,
            size
        );
        return fileWrapper;
    };

    const formatDate = (date) => {
        const addZero = (num) => (num > 9 ? num : "0" + num);
        date = new Date(date);
        const year = date.getFullYear();
        const month = addZero(date.getMonth() + 1);
        const day = addZero(date.getDate());
        const hour = addZero(date.getHours());
        const minute = addZero(date.getMinutes());
        const second = addZero(date.getSeconds());
        return "yyyy-MM-dd HH:mm:ss"
            .replace("yyyy", year)
            .replace("MM", month)
            .replace("dd", day)
            .replace("HH", hour)
            .replace("mm", minute)
            .replace("ss", second);
    };

    const formatSize = (size) => {
        let count = 0;
        while (size >= 1024) {
            size /= 1024;
            count++;
        }
        size = size.toFixed(2);
        switch (count) {
            case 1:
                size += " KB";
                break;
            case 2:
                size += " MB";
                break;
            case 3:
                size += " GB";
                break;
            case 4:
                size += " TB";
                break;
            case 5:
                size += " PB";
                break;
            default:
                size += " B";
        }
        return size;
    };

    let fileList = document.getElementById("file-list");
    fileList.innerHTML = "";
    files.files.forEach((file) => {
        if (file.name.split(".").pop() === "md") {
            if (file.url) {
                renderMarkdown(
                    files.parent + (files.parent === "/" ? "" : "/") + file.name,
                    file.url
                );
            }
        }
        if (file.name !== "README.md") {
            const parent = files.parent === window.api.root ? "" : files.parent;
            fileList.appendChild(
                createFileWrapper(
                    file.url ? "document" : "folder",
                    file.name,
                    formatDate(file.time),
                    formatSize(file.size),
                    parent + "/" + file.name,
                    file.url
                )
            );
        }
    });
}

async function renderTreeNode(files) {
    const createTreeNodeWrapper = (array, type, name, path) => {
        let treeNodeWrapper = document
            .getElementById("tree-node-wrapper-template")
            .content.cloneNode(true);
        let icons = treeNodeWrapper.querySelectorAll("ion-icon");
        icons[0].setAttribute("name", array);
        icons[1].setAttribute("name", type);
        treeNodeWrapper.querySelector(".tree-node-name").innerText = name;
        treeNodeWrapper.appendNode = (node) =>
            treeNodeWrapper.querySelector(".tree-node-wrapper").append(node);
        addTreeNodeListener(
            treeNodeWrapper.querySelector(".tree-node"),
            path
        );
        return treeNodeWrapper;
    };

    const paths = files.parent.split("/");
    let absolutePath = (max) => {
        let absolutePath = "";
        for (let j = 1; j <= max; j++) {
            absolutePath += "/" + paths[j];
        }
        return absolutePath;
    };
    let maxIndex = paths.length - 1;
    let currentTreeNode = createTreeNodeWrapper(
        "arrow-dropdown",
        "folder-open",
        paths[maxIndex],
        absolutePath(maxIndex)
    );
    files.files.forEach((file) => {
        if (!file.url) {
            currentTreeNode.appendNode(
                createTreeNodeWrapper(
                    "arrow-dropright",
                    "folder",
                    file.name,
                    files.parent + "/" + file.name
                )
            );
        }
    });

    for (let i = maxIndex - 1; i > 0; i--) {
        const currentTreeNodeParentAbsolutePath = absolutePath(i);
        let currentTreeNodeParent = createTreeNodeWrapper(
            "arrow-dropdown",
            "folder",
            paths[i],
            currentTreeNodeParentAbsolutePath
        );
        let cache = window.fileCache.get(currentTreeNodeParentAbsolutePath);
        if (cache) {
            cache.files.forEach((file) => {
                if (!file.url) {
                    if (file.name === paths[i + 1]) {
                        currentTreeNodeParent.appendNode(currentTreeNode);
                    } else {
                        currentTreeNodeParent.appendNode(
                            createTreeNodeWrapper(
                                "arrow-dropright",
                                "folder",
                                file.name,
                                currentTreeNodeParentAbsolutePath + "/" + file.name
                            )
                        );
                    }
                }
            });
        } else {
            currentTreeNodeParent.appendNode(currentTreeNode);
        }
        currentTreeNode = currentTreeNodeParent;
    }

}

async function renderMarkdown(path, url) {
    const render = (text) => {
        let markedText;
        try {
            markedText = marked(text, {
                gfm: true,
                highlight: (code, lang, callback) => {
                    return hljs.highlight(lang, code).value;
                },
            });
        } catch (e) {
            markedText = marked(text, {
                gfm: true,
                highlight: (code, lang, callback) => {
                    return hljs.highlight("bash", code).value;
                },
            });
        }
        if (
            window.backFordwardCache.current +
            (window.backFordwardCache.current === "/" ? "" : "/") +
            "README.md" ===
            path
        ) {
            if (!window.backFordwardCache.preview) {
                document.getElementById("readme").innerHTML = markedText;
                document.querySelector(".markdown-body").style.display = "block";
            }
        } else if (window.backFordwardCache.preview) {
            const markdownBody = document.createElement("div");
            markdownBody.classList.add("markdown-body");
            markdownBody.innerHTML = markedText;
            const content = document.querySelector(".content");
            content.innerHTML = "";
            content.appendChild(markdownBody);
        }
        let cache = window.fileCache.get(path);
        if (!cache || cache === true) {
            window.fileCache.set(path, text);
        }
    };

    if (
        window.backFordwardCache.current +
        (window.backFordwardCache.current === "/" ? "" : "/") +
        "README.md" ===
        path
    ) {
        const readme = document.getElementById("readme");
        if (!readme.querySelector(".sk-folding-cube")) {
            readme.innerHTML = "";
            readme.appendChild(
                document
                    .getElementById("loading-wrapper-templete")
                    .content.cloneNode(true)
            );
            document.querySelector(".markdown-body").style.display = "block";
        }
    }

    let text = window.fileCache.get(path);
    if (text === true) {
        setTimeout(() => renderMarkdown(path, url), 200);
        // let cacheWaitReadmeFetch = setInterval(() => {
        //   text = window.fileCache.get(path);
        //   if (typeof text === "object") {
        //     render(text, path);
        //     clearInterval(cacheWaitReadmeFetch);
        //   } else if (text === false) {
        //     clearInterval(cacheWaitReadmeFetch);
        //   }
        // }, 100);
    } else if (text) {
        render(text, path);
    } else {
        window.fileCache.set(path, true);
        sendRequest(
            "GET",
            url,
            null,
            null,
            (text) => render(text, path),
            () => window.fileCache.set(path, false)
        );
    }
}

function handleEncryptedFolder(files) {
    switchRightDisplay("encrypted");
    const password = document.querySelector(".password");
    const input = password.querySelector("input");
    const button = password.querySelector("button");
    const buttonParent = button.parentElement;
    const buttonClone = button.cloneNode(true);
    buttonParent.replaceChild(buttonClone, button);
    input.placeholder = "请输入密码";
    buttonClone.addEventListener("click", (event) => {
        const passwd = input.value;
        if (!input.value) {
            return;
        }
        input.value = "";
        input.placeholder = "正在验证..";
        sendRequest(
            window.api.method,
            window.api.url,
            window.api.formatPayload(files.parent, passwd),
            window.api.headers,
            (data) => {
                const newFiles = JSON.parse(data);
                if (newFiles.encrypted) {
                    input.placeholder = "密码错误";
                } else {
                    window.fileCache.set(newFiles.parent, newFiles);
                    fetchFileList(newFiles.parent);
                }
            },
            () => window.fileCache.set(newFiles.parent, false)
        );
    });
}

function addPathListener(elem, path) {
    elem.addEventListener("click", (event) => {
        fetchFileList(path);
        switchBackForwardStatus(path);
    });
}

function addTreeNodeListener(elem, path) {
    elem.addEventListener("click", (event) => {
        fetchFileList(path);
        switchBackForwardStatus(path);
    });
}

function addFileListLineListener(elem, path, url, size) {
    if (url) {
        elem.addEventListener("click", (event) => {
            window.backFordwardCache.preview = true;
            const previewHandler = {
                copyTextContent: (source, text) => {
                    let result = false;
                    let target = document.createElement("pre");
                    target.style.opacity = "0";
                    target.textContent = text || source.textContent;
                    document.body.appendChild(target);
                    try {
                        let range = document.createRange();
                        range.selectNode(target);
                        window.getSelection().removeAllRanges();
                        window.getSelection().addRange(range);
                        document.execCommand("copy");
                        window.getSelection().removeAllRanges();
                        result = true;
                    } catch (e) { }
                    document.body.removeChild(target);
                    return result;
                },
                fileType: (suffix) => {
                    Array.prototype.contains = function (search) {
                        const object = this;
                        for (const key in object) {
                            if (object.hasOwnProperty(key)) {
                                if (eval("/^" + search + "$/i").test(object[key])) {
                                    return true;
                                }
                            }
                        }
                        return false;
                    };
                    if (
                        ["bmp", "jpg", "png", "svg", "webp", "gif"].contains(suffix)
                    ) {
                        return "image";
                    } else if (["mp3", "flac", "wav"].contains(suffix)) {
                        return "audio";
                    } else if (
                        ["mp4", "avi", "mkv", "flv", "m3u8"].contains(suffix)
                    ) {
                        return "video";
                    } else if (
                        [
                            "txt",
                            "js",
                            "json",
                            "css",
                            "html",
                            "java",
                            "c",
                            "cpp",
                            "php",
                            "cmd",
                            "ps1",
                            "bat",
                            "sh",
                            "py",
                            "go",
                            "asp",
                        ].contains(suffix)
                    ) {
                        return "text";
                    } else if (
                        [
                            "doc",
                            "docx",
                            "ppt",
                            "pptx",
                            "xls",
                            "xlsx",
                            "mpp",
                            "rtf",
                            "vsd",
                            "vsdx",
                        ].contains(suffix)
                    ) {
                        return "office";
                    } else if (["md"].contains(suffix)) {
                        return "markdown";
                    }
                },
                loadResource: (resource, callback) => {
                    let type;
                    switch (resource.split(".").pop()) {
                        case "css":
                            type = "link";
                            break;
                        case "js":
                            type = "script";
                            break;
                    }
                    let element = document.createElement(type);
                    let loaded = false;
                    if (typeof callback === "function") {
                        element.onload = element.onreadystatechange = () => {
                            if (
                                !loaded &&
                                (!element.readyState ||
                                    /loaded|complete/.test(element.readyState))
                            ) {
                                element.onload = element.onreadystatechange = null;
                                loaded = true;
                                callback();
                            }
                        };
                    }
                    if (type === "link") {
                        element.href = resource;
                        element.rel = "stylesheet";
                    } else {
                        element.src = resource;
                    }
                    document.getElementsByTagName("head")[0].appendChild(element);
                },

                createDplayer: (video, type, elem) => {
                    const host = "//s0.pstatp.com/cdn/expire-1-M";
                    const resources = [
                        "/dplayer/1.25.0/DPlayer.min.css",
                        "/dplayer/1.25.0/DPlayer.min.js",
                        "/hls.js/0.12.4/hls.light.min.js",
                        "/flv.js/1.5.0/flv.min.js",
                    ];
                    let unloadedResourceCount = resources.length;
                    resources.forEach((resource) => {
                        previewHandler.loadResource(host + resource, () => {
                            if (!--unloadedResourceCount) {
                                let option = {
                                    url: video,
                                };
                                if (type === "flv") {
                                    option.type = "flv";
                                }
                                new DPlayer({
                                    container: elem,
                                    screenshot: true,
                                    video: option,
                                });
                            }
                        });
                    });
                },
            };

            const suffix = path.split(".").pop();
            let content = document.querySelector(".content");

            content.appendChild(
                document
                    .getElementById("loading-wrapper-templete")
                    .content.cloneNode(true)
            );

            let contentType = previewHandler.fileType(suffix);
            switch (contentType) {
                case "image":
                    let img = new Image();
                    img.style.maxWidth = "100%";
                    img.src = url;
                    let fancy = document.createElement("a");
                    fancy.setAttribute("data-fancybox", "image");
                    fancy.href = img.src;
                    fancy.append(img);
                    content.innerHTML = "";
                    content.append(fancy);
                    break;
                case "audio":
                    let audio = new Audio();
                    audio.style.outline = "none";
                    audio.preload = "auto";
                    audio.controls = "controls";
                    audio.style.width = "100%";
                    audio.src = url;
                    content.innerHTML = "";
                    content.append(audio);
                    break;
                case "video":
                    let video = document.createElement("div");
                    previewHandler.createDplayer(url, suffix, video);
                    content.innerHTML = "";
                    content.append(video);
                    break;
                case "text":
                    sendRequest("GET", url, null, null, (data) => {
                        let pre = document.createElement("pre");
                        let code = document.createElement("code");
                        pre.append(code);
                        pre.style.background = "rgb(245,245,245)";
                        pre.style["overflow-x"] = "scroll";
                        pre.classList.add(suffix);
                        // content.style.textAlign = "initial";
                        content.innerHTML = "";
                        content.append(pre);
                        code.textContent = data;
                        if (
                            size.indexOf(" B") >= 0 ||
                            (size.indexOf(" KB") && size.split(" ")[0] < 100)
                        ) {
                            hljs.highlightBlock(pre);
                        }
                    });
                    break;
                case "markdown":
                    renderMarkdown(path, url);
                    break;
                case "office":
                    const officeOnline =
                        "//view.officeapps.live.com/op/view.aspx?src=" +
                        encodeURIComponent(url);
                    let div = document.createElement("div");
                    div.style.lineHeight = "2em";
                    div.style.background = "rgba(218, 215, 215, 0.21)";
                    div.style.webkitTapHighlightColor = "rgba(0, 0, 0, 0)";
                    div.style.cursor = "pointer";
                    div.style.textAlign = "center";
                    div.innerHTML = "新窗口打开";
                    div.addEventListener("click", () => window.open(officeOnline));
                    content.innerHTML = "";
                    content.appendChild(div);
                    if (document.body.clientWidth >= 480) {
                        let iframe = document.createElement("iframe");
                        iframe.width = "100%";
                        iframe.style.height = "41em";
                        iframe.style.border = "0";
                        iframe.src = officeOnline;
                        content.appendChild(iframe);
                    }
                    break;
                default:
                    let textWrapper = document.createElement("div");
                    textWrapper.style.textAlign = "center";
                    textWrapper.innerHTML = "该文件不支持预览";
                    content.innerHTML = "";
                    content.appendChild(textWrapper);
                    break;
            }
            document.querySelector(".file-name").innerHTML = path;
            document
                .querySelector(".btn.download")
                .addEventListener("click", () => (location.href = url));
            document
                .querySelector(".btn.quote")
                .addEventListener("click", (event) => {
                    previewHandler.copyTextContent(
                        null,
                        window.api.url + "?file=" + encodeURI(path)
                    );
                    const btn = document.querySelector(".btn.quote");
                    btn.innerHTML = "已复制";
                    setTimeout(() => (btn.innerHTML = "引用"), 250);
                });
            document
                .querySelector(".btn.share")
                .addEventListener("click", (event) => {
                    const sharePath = () => {
                        let arr = window.backFordwardCache.current.split("/");
                        let r = "";
                        for (let i = 1; i < arr.length; i++) {
                            r += "/" + arr[i];
                        }
                        return r;
                    };
                    previewHandler.copyTextContent(
                        null,
                        window.location.origin +
                        window.location.pathname +
                        "?path=" +
                        encodeURI(sharePath())
                    );
                    const btn = document.querySelector(".btn.share");
                    btn.innerHTML = "已复制";
                    setTimeout(() => (btn.innerHTML = "分享"), 250);
                });
            switchRightDisplay("preview");

            if (contentType !== "video") return;

            let start = null;
            let right = document.querySelector(".right");
            const scrollToBottom = (timestamp) => {
                if (!start) start = timestamp;
                let progress = timestamp - start;
                let last = right.scrollTop;
                right.scrollTo(0, right.scrollTop + 14);
                if (right.scrollTop !== last && progress < 1000 * 2) {
                    window.requestAnimationFrame(scrollToBottom);
                }
            };
            window.requestAnimationFrame(scrollToBottom);
        });
    } else {
        elem.addEventListener("click", (event) => {
            fetchFileList(path);
            switchBackForwardStatus(path);
        });
    }
}

function addBackForwardListener() {
    document.getElementById("arrow-back").addEventListener("click", back);
    document
        .getElementById("arrow-forward")
        .addEventListener("click", forward);
    document.querySelector("#main-page").addEventListener("click", () => {
        fetchFileList(window.api.root);
        switchBackForwardStatus(window.api.root);
    });
}

function switchRightDisplay(display) {
    if (display === "preview") {
        document.querySelector(".list-header").style.display = "none";
        document.querySelector("#file-list").style.display = "none";
        document.querySelector(".markdown-body").style.display = "none";
        document.querySelector(".password").style.display = "none";
        document.querySelector(".preview").style.display = "initial";
    } else if (display === "encrypted") {
        document.querySelector(".list-header").style.display = "none";
        document.querySelector("#file-list").style.display = "none";
        document.querySelector(".markdown-body").style.display = "none";
        document.querySelector(".preview").style.display = "none";
        document.querySelector(".password").style.display = "initial";
        document.querySelector("#readme").innerHTML = "";
        let content = document.querySelector(".preview .content");
        if (content) {
            document.querySelector(".preview .content").innerHTML = "";
        }
    } else {
        document.querySelector(".list-header").style.display = "initial";
        document.querySelector("#file-list").style.display = "initial";
        document.querySelector(".markdown-body").style.display = "none";
        document.querySelector(".preview").style.display = "none";
        document.querySelector(".password").style.display = "none";
        document.querySelector("#readme").innerHTML = "";
        let content = document.querySelector(".preview .content");
        if (content) {
            document.querySelector(".preview .content").innerHTML = "";
        }
    }
}

function switchBackForwardStatus(path) {
    if (path) {
        window.backFordwardCache.deepest = path;
    }
    if (
        window.backFordwardCache.root !== window.backFordwardCache.current
    ) {
        window.backFordwardCache.backable = true;
        document.getElementById("arrow-back").style.color = "black";
    } else {
        window.backFordwardCache.backable = false;
        document.getElementById("arrow-back").style.color =
            "rgb(218, 215, 215)";
    }
    if (
        window.backFordwardCache.deepest !== window.backFordwardCache.current
    ) {
        window.backFordwardCache.forwardable = true;
        document.getElementById("arrow-forward").style.color = "black";
    } else {
        window.backFordwardCache.forwardable = false;
        document.getElementById("arrow-forward").style.color =
            "rgb(218, 215, 215)";
    }
}

function back() {
    if (!window.backFordwardCache.backable) {
        return;
    }
    if (window.backFordwardCache.preview) {
        fetchFileList(window.backFordwardCache.current);
    } else {
        let former = (() => {
            let formerEndIndex =
                window.backFordwardCache.current.lastIndexOf("/");
            return window.backFordwardCache.current.substring(
                0,
                formerEndIndex
            );
        })();
        former = former || window.api.root;
        fetchFileList(former);
        switchBackForwardStatus();
    }
    // console.log(window.backFordwardCache);
}

function forward() {
    if (!window.backFordwardCache.forwardable) {
        return;
    }
    const current =
        window.backFordwardCache.current === window.api.root
            ? ""
            : window.backFordwardCache.current;
    const subLength = current ? current.length : 0;
    const later =
        current +
        "/" +
        window.backFordwardCache.deepest.substring(subLength).split("/")[1];
    fetchFileList(later);
    switchBackForwardStatus();
    // console.log(window.backFordwardCache);
}

async function preCache(files, level) {
    if (level > 1) return;
    files.files.forEach((file) => {
        const parent = files.parent === "/" ? "" : files.parent;
        const path = parent + "/" + file.name;
        if (!file.url) {
            // console.log('caching ' + path + ', level ' + level);
            window.fileCache.set(path, true);
            sendRequest(
                window.api.method,
                window.api.url,
                window.api.formatPayload(path),
                window.api.headers,
                (data) => {
                    const files = JSON.parse(data);
                    window.fileCache.set(path, files);
                    preCache(files, level + 1);
                },
                () => window.fileCache.set(path, false)
            );
        } else if (file.name.split(".").pop() === "md") {
            // console.log('caching ' + path + ', level ' + level);
            window.fileCache.set(path, true);
            sendRequest(
                "GET",
                file.url,
                null,
                null,
                (text) => window.fileCache.set(path, text),
                () => window.fileCache.set(path, false)
            );
        }
    });
}

async function preCacheCheck(cache, path) {
    cache.files.forEach((file) => {
        const prefix = path === window.api.root ? "" : path;
        const nextPath = prefix + "/" + file.name;
        const pathCache = window.fileCache.get(nextPath);
        if (!file.url) {
            if (!pathCache) {
                // console.log('inner caching ' + nextPath);
                window.fileCache.set(nextPath, true);
                sendRequest(
                    window.api.method,
                    window.api.url,
                    window.api.formatPayload(nextPath),
                    window.api.headers,
                    (data) => {
                        const files = JSON.parse(data);
                        window.fileCache.set(nextPath, files);
                        preCache(files, 0);
                    },
                    () => window.fileCache.set(nextPath, false)
                );
            } else if (pathCache.files) {
                preCacheCheck(pathCache, nextPath);
            }
        } else if (file.name.split(".").pop() === "md") {
            if (!pathCache && pathCache !== true) {
                // console.log('inner caching ' + nextPath);
                window.fileCache.set(nextPath, true);
                sendRequest(
                    "GET",
                    file.url,
                    null,
                    null,
                    (text) => window.fileCache.set(nextPath, text),
                    () => window.fileCache.set(nextPath, false)
                );
            }
        }
    });
}

function fetchFileList(path) {
    // console.log('fetching ' + path);
    let loading = document.querySelector(".loading-wrapper");
    loading.style.display = "initial";
    window.backFordwardCache.preview = false;
    window.backFordwardCache.current = path;

    let cache = window.fileCache.get(path);
    if (cache === true) {
        setTimeout(() => fetchFileList(path), 200);
    } else if (cache) {
        renderPage(null, cache);
        preCacheCheck(cache, path);
    } else {
        window.fileCache.set(path, true);
        sendRequest(
            window.api.method,
            window.api.url,
            window.api.formatPayload(path),
            window.api.headers,
            renderPage,
            () => {
                window.fileCache.set(path, false);
                const loadingText = loading.querySelector(".loading");
                loadingText.innerText = "Failed!";
                setTimeout(() => {
                    loading.style.display = "none";
                    loadingText.innerText = "Loading..";
                }, 2000);
            }
        );
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.title = window.GLOBAL_CONFIG.SITE_NAME;
    document.querySelector(".site").textContent =
        window.GLOBAL_CONFIG.SITE_NAME;
    window.api = {
        root: "/",
        url: window.GLOBAL_CONFIG.SCF_GATEWAY,
        method: "POST",
        formatPayload: (path, passwd) => {
            return (
                "?path=" +
                encodeURIComponent(path) +
                "&encrypted=" +
                window.api.accessToken.encrypted +
                "&plain=" +
                window.api.accessToken.plain +
                "&passwd=" +
                passwd
            );
        },
        headers: {
            "Content-type": "application/x-www-form-urlencoded",
        },
    };
    window.backFordwardCache = {
        root: window.api.root,
        deepest: window.api.root,
        current: window.api.root,
        backable: false,
        forwardable: false,
        preview: false,
    };
    window.fileCache = new Map();
    const initialPath =
        new URLSearchParams(window.location.search).get("path") ||
        window.api.root;
    if (window.GLOBAL_CONFIG.IS_CF) {
        window.api.accessToken = {
            encrypted: "",
            plain: "",
        };
        fetchFileList(initialPath);
        addBackForwardListener();
    } else {
        sendRequest(
            window.api.method,
            window.api.url + "?accessToken",
            null,
            window.api.headers,
            (data) => {
                const accessToken = JSON.parse(data);
                window.api.accessToken = {
                    encrypted: accessToken.encrypted,
                    plain: accessToken.plain,
                };
                fetchFileList(initialPath);
                addBackForwardListener();
            }
        );
    }
});