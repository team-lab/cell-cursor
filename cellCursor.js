/*jshint globalstrict: true*/
/*global $:false, angular, setTimeout */

"use strict";
(function(angular){
var $ = angular.element;
function isKeyAcceptElement(e, thisElement){
  while(e){
    if(e.tagName=="INPUT"||e.tagName=="TEXTAREA"||e.contentEditable=='true'||e.tagName=='SELECT')
      return true;
    if(e==thisElement)
      return false;
    e=e.parentNode;
  }
  return false;
}
function emitAndApply(scope, emitter){
  return function(){
    var ev = emitter.$emit.apply(emitter,arguments);
    if(!ev.defaultPrevented){
      scope.$apply();
    }
  };
}
var isMSIE = typeof(MSEventObj)=='object';

/** @return xpath [HTMLElement] */
function xpath(elem, path){
  var r = elem.ownerDocument.evaluate(path, elem, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE, null);
  for(var l=r.snapshotLength, ret=new Array(l),i=0;i<l;i++){
    ret[i]=r.snapshotItem(i);
  }
  return ret;
}
function toArray(a){
  for(var l=a.length, ret=new Array(l),i=0;i<l;i++){
    ret[i]=a[i];
  }
  return ret;
}

function oddQuotes(str) {
  return (str.split('"').length - 1) & 1;
}
function tsvParse(text){
  if (typeof(text)!='string') {
    return text;
  }
  var ret = [];
  var rows = text.split('\n');
  if (rows.length && rows[rows.length - 1] === '') {
    rows.pop();
  }

  var cr, multiline=false;
  for (var r = 0, rLen = rows.length; r < rLen; r ++) {
    if (!multiline) {
      cr = [];
      ret.push(cr);
    }
    var cols = rows[r].split('\t');
    for (var c = 0, cLen = cols.length; c < cLen; c ++) {
      var col = cols[c];
      if (multiline && c === 0) {
        if (oddQuotes(col)) {
          multiline = false;
          col = col.substring(0, col.length - 1).replace(/""/g, '"');
        }
        cr[cr.length-1] += '\n' + col;
      } else {
        if (c === cLen - 1 && col.charAt(0)=='"' && oddQuotes(col)) {
          col = col.substring(1);
          multiline = true;
        } else {
          multiline = false;
        }
        cr.push(col.replace(/""/g, '"'));
      }
    }
  }
  return ret;
}
function tsvBuild(arr){
  if(arr && arr.length){
    var str = [];
    for(var i=0;i<arr.length;i++){
      var a = arr[i];
      var r = [];
      for(var j=0;j<a.length;j++){
        var v = a[j];
        if(typeof(v)=='string'){
          if(v.indexOf("\n") > -1){
            r.push('"' + v.replace(/"/g, '""') + '"');
          }else{
            r.push(v);
          }
        }else{
          r.push((v === null || v === undefined) ? "" : v);
        }
      }
      str.push(r.join("\t"));
    }
    return str.join("\n");
  }
  return arr;
}

function Range(pos,expanding){
  if(!pos){
    this.deselect();
  }else{
    this.setCurrent(pos,expanding);
  }
}
function ifMoving(old,pos){
  return (!old||old.row!=pos.row||old.col!=pos.col) ? pos : old;
}
Range.prototype.setCurrent=function(pos, expanding){
  this.cursor = ifMoving(this.cursor,{
    row:pos.row,
    col:pos.col
  });
  if(typeof(expanding)=='object'){
    this.start = ifMoving(this.start,{
      row:expanding.row,
      col:expanding.col
    });
  }
  if(!expanding||!this.start){
    this.start = this.topLeft = this.bottomRight = this.cursor;
  }else{
    this.topLeft = ifMoving(this.topLeft,{
      row:Math.min(this.start.row,this.cursor.row),
      col:Math.min(this.start.col,this.cursor.col)
    });
    this.bottomRight = ifMoving(this.bottomRight,{
      row:Math.max(this.start.row,this.cursor.row),
      col:Math.max(this.start.col,this.cursor.col)
    });
  }
};
Range.prototype.isInRange=function(pos){
  return this.cursor && this.topLeft.row <= pos.row && pos.row <= this.bottomRight.row &&
    this.topLeft.col <= pos.col && pos.col <= this.bottomRight.col;
};
Range.prototype.deselect=function(){
  this.cursor = this.start = this.topLeft = this.bottomRight = undefined;
};
/**
 * CellCursor controller
 */
function CellCursor($scope){
  this.table=undefined;
  this.selected = new Range();
  this.padding={
    left:0,
    right:0
  };
  this.scope = undefined;
  this.hasFocus = false;
}
/**
 * focus to table.
 */
CellCursor.prototype.focus = function(){
  if(this.table[0].ownerDocument.activeElement){
    this.table[0].ownerDocument.activeElement.blur();
  }
  this.hasFocus=true;
};
/**
 * remove focus from table. if table has not focus.
 */
CellCursor.prototype.blur = function(){
  this.hasFocus=false;
};
/**
 * focus to table.
 * @param focus:Boolean
 * @return true if change focus
 */
CellCursor.prototype.setFocus = function(focus){
  if(this.hasFocus!=focus){
    if(focus){
      this.focus();
    }else{
      this.blur();
    }
    return true;
  }
};
/** @return HTMLTableSectionElement */
CellCursor.prototype.tBody = function(){
  return this.table[0].tBodies[0];
};
/** @return HTMLTableColElement */
CellCursor.prototype.col = function(c){
  if(!this._colgroup){
    this._colgroup = xpath(this.table[0],"colgroup")[0];
    if(!this._colgroup){
      this._colgroup = this.table[0].ownerDocument.createElement('COLGROUP');
      this.table.prepend(this._colgroup);
    }
  }
  while(!this._colgroup.children[c+this.padding.left]){
    var col =this.table[0].ownerDocument.createElement('COL');
    this._colgroup.appendChild(col);
  }
  return this._colgroup.children[c+this.padding.left];
};
/** @return [tr:HTMLTableRowElement] */
CellCursor.prototype.rows=function(){
  var b = this.tBody();
  if(b){
    return b.rows;
  }else{
    return [];
  }
};
/**
 * @param e:HTMLElement
 * @return HTMLTableCellElement|undefined
 */
CellCursor.prototype.closestCell=function(e){
  var parent=this.tBody();
  while(e.parentNode){
    if(e.parentNode.parentNode==parent)
      return e;
    e=e.parentNode;
  }
  return undefined;
};
/**
 * find cell by position.
 * @param pos:{row,col}
 * @return td:HTMLTableCellElement
 */
CellCursor.prototype.td=function(pos){
  if(!pos)return;
  var b = this.tBody();
  if(b){
    var tr = b.rows[pos.row];
    if(tr && tr.cells){
      return tr.cells[pos.col+this.padding.left];
    }
  }
};
/**
 * @param td:HTMLTableCellElement
 * @return true if td is in this table.tbody
 */
CellCursor.prototype.isTd=function(td){
  return td && td.parentNode && td.parentNode.parentNode==this.tBody();
};
/**
 * get position of td element.
 * @param td:HTMLTableCellElement
 * @return {row,col}
 */
CellCursor.prototype.pos=function(td){
  return {
    row:td.parentNode.sectionRowIndex,
    col:td.cellIndex-this.padding.left
  };
};

/** @return [{row:number, tr:HTMLTableRowElement}] */
CellCursor.prototype.getSelectedRows=function(selected){
  if(typeof(selected)=='undefined')selected=this.selected;
  var ret = [];
  if(!selected.cursor) return ret;
  var rows = this.rows();
  for(var i=selected.topLeft.row,l=selected.bottomRight.row;i<=l;i++){
    if(!rows[i])break;
    ret.push({row:i,tr:rows[i]});
  }
  return ret;
};
/** @return [{row:number,cells:[{row:number,col:number,cell:HTMLTableCellElement}]}] */
CellCursor.prototype.getSelectedCells=function(selected){
  if(typeof(selected)=='undefined')selected=this.selected;
  var rows = this.getSelectedRows(selected);
  var ret = [];
  for(var i=0,l=rows.length;i<l;i++){
    var tdlist = rows[i].tr.cells;
    var r = rows[i].row;
    var cells = [];
    for(var j=selected.topLeft.col,jl=selected.bottomRight.col;j<=jl;j++){
      cells.push({row:r,col:j,cell:tdlist[j+this.padding.left]});
    }
    ret.push({row:r, cells:cells});
  }
  return ret;
};
/** @return a value use table-data-options or ng-model.$viewValue */
CellCursor.prototype.getCellViewValue=function(td){
  var e = angular.element(td).data();
  if(e.$cellCursorOptionsController){
    var r = e.$cellCursorOptionsController.getValueOpt();
    if(r){
      return r[0];
    }
  }
  if(e.$ngModelController){
    return e.$ngModelController.$viewValue;
  }
};
CellCursor.prototype.setCellValue=function(td, data){
  if(td.getAttribute("readonly"))return;
  var e = angular.element(td).data();
  if(e.$cellCursorOptionsController){
    e.$cellCursorOptionsController.setValue(data);
  }else if(e.$ngModelController){
    e.$ngModelController.$setViewValue(data);
  }
};

/** get table size (without padding)
 * @return {row:number,col:number}
 */
CellCursor.prototype.size = function(){
  var b = this.tBody();
  if(b){
    var row = b.rows.length;
    if(row){
      return {row:row, col:b.rows[0].cells.length - this.padding.left - this.padding.right};
    }
  }
};
/**
 * @param selected:Range|undefined  if selected is undefined, set for cursor selected range
 * @return values:[[v:Any,v:Any,....]] selected area values
 */
CellCursor.prototype.getSelectedCellValues=function(selected){
  var ret = [];
  var rows = this.getSelectedCells(selected);
  for(var r=0;r<rows.length;r++){
    var cells = rows[r].cells;
    var vals = [];
    for(var c=0;c<cells.length;c++){
      vals.push(this.getCellViewValue(cells[c].cell));
    }
    ret.push(vals);
  }
  return ret;
};
/**
 * @param values:[[v,v,...]]
 * @param selected:Range|undefined  if selected is undefined, set for cursor selected range
 */
CellCursor.prototype.setSelectedCellValues=function(values, selected){
  if(!values) return;
  if(typeof(values)=='string')values=tsvParse(values);
  if(!angular.isArray(values))values=[values];
  var rows = this.getSelectedCells(selected);
  for(var r=0;r<rows.length && (r in values);r++){
    var cells = rows[r].cells;
    var vals = values[r];
    if(!angular.isArray(vals))vals=[vals];
    for(var c=0;c<cells.length && (c in vals);c++){
      this.setCellValue(cells[c].cell, vals[c]);
    }
  }
};
/**
 * Set selected range.
 * If expanding is object, it is set start position.
 * If expanding is true, start position dose not move.
 * If expanding is false, start position set `pos`.
 * @param pos:{row,col}
 * @param expanding:Boolean|{row,col}
 */
CellCursor.prototype.select = function(pos,expanding){
  if(!pos)return;
  this.focus();
  var size = this.size();
  if(!size||!size.row||!size.col){
    return;
  }
  if(expanding&&typeof(expanding)=='object'){
    expanding=wrapCursor(expanding,size);
  }
  this.selected.setCurrent(wrapCursor(pos,size),expanding);
};
function stopCursor(pos, size){
  return {
    col: ((isNaN(pos.col)||pos.col<size.col) ? 0 : ((pos.col>=0) ? size.col-1 : pos.col)),
    row: ((isNaN(pos.row)||pos.row<size.row) ? 0 : ((pos.row>=0) ? size.row-1 : pos.row))
  };
}
function wrapCursor(pos, size){
  return {
    col: ((isNaN(pos.col)||pos.col>=size.col) ? 0 : ((pos.col<0) ? size.col-1 : pos.col)),
    row: ((isNaN(pos.row)||pos.row>=size.row) ? 0 : ((pos.row<0) ? size.row-1 : pos.row))
  };
}
/**
 * move cursor. like `select({row:(selected.cursor.row+pos.row), col:(selected.cursor.col+pos.col)})`.
 * @param move:{row,col}
 * @param expanding:Boolean|{row,col}
 */
CellCursor.prototype.selectMove = function(move,expanding){
  var c = this.selected.cursor||{};
  var size = this.size();
  if(!size||!size.row||!size.col){
    return;
  }
  var pos=wrapCursor({row:c.row + (move.row||0), col:c.col + (move.col||0)},size);
  if(expanding&&typeof(expanding)=='object'){
    expanding=wrapCursor(expanding,size);
  }
  this.select(pos, expanding);
};
/**
 * deselect
 */
CellCursor.prototype.deselect = function(){
  this.selected.deselect();
};

/** @param e:KeydownEvent */
CellCursor.prototype.keyMoveHandler = function(e){
  if(e.ctrlKey||e.metaKey||e.altKey) return;
  switch(e.keyCode){
  case 38: // UP
    this.selectMove({row:-1,col:0},e.shiftKey);
    return true;
  case 40: // DOWN
    this.selectMove({row:+1,col:0},e.shiftKey);
    return true;
  case 37: // LEFT
    this.selectMove({row:0,col:-1},e.shiftKey);
    return true;
  case 39: // RIGHT
    this.selectMove({row:0,col:+1},e.shiftKey);
    return true;
  case 9: // TAB
    this.selectMove({row:0,col:e.shiftKey ? -1:+1});
    return true;
  case 27: // ESC
    this.selected.deselect();
    return true;
  }
};
/** set event fook */
CellCursor.prototype.$on = function(){
  return this.scope.$on.apply(this.scope, arguments);
};
/** emit event */
CellCursor.prototype.$emit = function(){
  return this.scope.$emit.apply(this.scope, arguments);
};
/**
 * @param td:HTMLTableCellElement
 * @param event:Event (type=='keydown'|'keyup'|'keypress')
 * @return isStopImmediatePropagation
 */
CellCursor.prototype.onCellEvent = function(td, event){
  if(!td){
    td = this.td(this.selected.cursor);
    if(!td) return;
  }
  var d = angular.element(td).data();
  if(d.$cellCursorOptionsController){
    return d.$cellCursorOptionsController.onCellEvent(event,this,td);
  }
};
/** @param td:HTMLTableCellElement */
CellCursor.prototype.openEditor = function(td){
  if(!td){
    td = this.td(this.selected.cursor);
    if(!td) return;
  }
  var d = angular.element(td).data();
  if(d.$cellCursorOptionsController){
    var self = this;
    return  d.$cellCursorOptionsController.openEditor(td,function(){
      self.focus();
    }, this);
  }
};
/**
 * set class for tr as `tr.area`, `tr.area-t` (top), `tr.area-b` (bottom),
 * and set class for td as `td.area`, `td.area-l` (left), `td.area-r` (right).
 * @param klass:string area class name
 * @param v:{bottomRight:{row,col},bottomRight:{row,col}} new area range
 */
CellCursor.prototype.drawAreaClass = function(klass, v){
  var o,b,r,td,tr,c, removes=[];
  b = this.tBody();
  $(this.table[0].querySelectorAll("tbody>tr>td."+klass))
    .removeClass(klass+" "+klass+"-l "+klass+"-r");
  $(this.table[0].querySelectorAll("colgroup>col."+klass))
    .removeClass(klass+" "+klass+"-l "+klass+"-r");
  $(this.table[0].querySelectorAll("tbody>tr."+klass))
    .removeClass(klass+" "+klass+"-t "+klass+"-b");
  if(v&&v.topLeft){
    for(r=v.topLeft.row,tr=b.rows[r];r<=v.bottomRight.row && tr;r++,tr=b.rows[r]){
      $(tr).addClass(klass);
      if(r==v.topLeft.row){
        $(tr).addClass(klass+"-t");
      }
      if(r==v.bottomRight.row){
        $(tr).addClass(klass+"-b");
      }
      for(c=v.topLeft.col,td=tr.cells[c+this.padding.left];c<=v.bottomRight.col && td;c++,td=tr.cells[c+this.padding.left]){
        $(td).addClass(klass);
        if(c==v.topLeft.col){
          $(td).addClass(klass+"-l");
        }
        if(c==v.bottomRight.col){
          $(td).addClass(klass+"-r");
        }
      }
    }
    for(c=v.topLeft.col;c<=v.bottomRight.col;c++){
      td = $(this.col(c));
      td.addClass(klass);
      if(c==v.topLeft.col){
        td.addClass(klass+"-l");
      }
      if(c==v.bottomRight.col){
        td.addClass(klass+"-r");
      }
    }
  }
};
/**
 * set class for tr and td as `.cursor`,
 * @param klass:string area class name
 * @param v:{bottomRight:{row,col},bottomRight:{row,col}} new area range
 */
CellCursor.prototype.drawCursorClass = function(klass, v){
  $(this.table[0].querySelectorAll("tbody>tr>td."+klass)).removeClass(klass);
  $(this.table[0].querySelectorAll("colgroup>col."+klass)).removeClass(klass);
  $(this.table[0].querySelectorAll("tbody>tr."+klass)).removeClass(klass);
  if(v){
    var td = this.td(v);
    if(td){
      $(td).addClass(klass);
      $(td.parentNode).addClass(klass);
    }
    $(this.col(v.col)).addClass(klass);
  }
};
// for angular event https://github.com/angular/angular.js/blob/master/src/jqLite.js#L979
function eventWrap(e){
  if(e.originalEvent) return e;
  var o = {
    originalEvent:e,
    immediatePropagationStopped:false,
    defaultPrevented:false,
    isDefaultPrevented:function(){ return e.isDefaultPrevented(); },
    preventDefault:function(){ this.defaultPrevented=true; e.preventDefault(); },
    stopPropagation:function(){ e.stopPropagation(); },
    stopImmediatePropagation:function(){ this.immediatePropagationStopped=true; e.stopImmediatePropagation(); }
  };
  var n = ["altKey","charCode","ctrlKey","data","keyCode","keyIdentifier","location","metaKey","shiftKey","target","type","which","pageX","pageY"];
  var i=n.length-1,name=n[i];
  while(name){
    if(name in e){
      o[name]=e[name];
    }
    name=n[--i];
  }
  return o;
}

function appendDefaultStyle($document){
  if(!$document[0].getElementById('cell-cursor-default-styles')){
    $document.find('body').append($('<style id="cell-cursor-default-styles">').html(
      ".cell-cursor-col-resize{display:block;position:absolute;width:4px;right:0;top:0;bottom:0;cursor:col-resize}\n"+
      ".cell-cursor-row-resize{display:block;position:absolute;height:4px;right:0;left:0;bottom:0;cursor:row-resize}\n"));
  }
}

function stopEvent(e){
  e.stopPropagation();
  e.preventDefault();
  e.stopImmediatePropagation();
}
function resizeHandler(name, elem, cellCursor, handler){
  var td = elem.parent();
  var $document = angular.element(elem[0].ownerDocument);
  if(typeof(td[0].cellIndex)=='undefined'){
    throw new Error(name + " need to be child of td or th");
  }
  function tdSize(){
    return {
      width:td[0].offsetWidth,
      height:td[0].offsetHeight
    };
  }
  function tdPos(){
    return {
      col:td[0].cellIndex,
      row:td[0].parentNode.sectionRowIndex
    };
  }
  appendDefaultStyle($document);
  td.css({position:'relative'});
  elem.on('mousedown',function(e){
    var base = tdSize(), pos = tdPos();
    if(cellCursor){
      var e2 = cellCursor.$emit(name+".start", pos, tdSize());
      if(e2.defaultPrevented) return false;
    }
    handler.init(base);
    base.width -= e.pageX;
    base.height -= e.pageY;
    stopEvent(e);
    function dragHandler(e){
      var size = {
        width:base.width+e.pageX,
        height:base.height+e.pageY,
      };
      if(cellCursor){
        var e2 = cellCursor.$emit(name+".resizing", pos, size, tdSize());
        if(e2.defaultPrevented) return false;
      }
      handler.resize(size);
      stopEvent(e);
      if(cellCursor){
        cellCursor.$emit(name+".resized", pos, tdSize());
      }
    }
    $document.on('mousemove',dragHandler);
    $document.one('mouseup',function(e){
      stopEvent(e);
      if(cellCursor) cellCursor.$emit(name + ".end", pos, tdSize());
      $document.off('mousemove',dragHandler);
    });
  }).on('dblclick',function(e){
    if(cellCursor){
      var e2 = cellCursor.$emit(name+".reset", tdPos(), tdSize());
      if(e2.defaultPrevented) return false;
    }
    stopEvent(e);
    handler.reset(e);
  }).on('click',function(e){
    stopEvent(e);
  });
}

angular.module("cellCursor",[])
.factory("CellCursor",function(){
  return CellCursor;
})
.directive("cellCursor",["$document",'$window',"$parse",function($document,$window,$parse){
  return {
    restrict:"A",
    require:'cellCursor',
    controller:[CellCursor],
    link:function(scope, elem, attrs, cellCursor){
      var getter = $parse(attrs.cellCursor);
      cellCursor.table = elem;
      cellCursor.scope = scope.$root.$new(true);
      cellCursor.name = attrs.cellCursor;
      getter.assign(scope,cellCursor);
      elem.on("mousedown",function(e){
        var td = cellCursor.closestCell(e.target);
        if(!td)return;
        var pos = cellCursor.pos(td);
        cellCursor.select(pos, e.shiftKey);
        e.preventDefault();
        scope.$apply();
        function moving(e){
          var td = cellCursor.closestCell(e.target);
          if(!td)return;
          cellCursor.select(cellCursor.pos(td), true);
          scope.$apply();
        }
        $document.on('mouseup',function(){
          elem.off('mousemove',moving);
        });
        elem.on('mousemove',moving);
      });
      $document.on("mousedown",function(e){
        if(cellCursor.setFocus(elem[0]===e.target || (elem[0].compareDocumentPosition(e.target)&Node.DOCUMENT_POSITION_CONTAINED_BY))){
          scope.$apply();
        }
      });
      // forward evnt to table
      $document.on("keypress keyup keydown compositionstart compositionupdate compositionend input",function(e){
        if(cellCursor.hasFocus){
          elem.triggerHandler(eventWrap(e));
        }
      });
      elem.on("keypress keyup keydown",function(e){
        if(isKeyAcceptElement(e.target, elem[0]))return;
        if(cellCursor.onCellEvent(cellCursor.td(cellCursor.selected.cursor),e)){
          scope.$apply();
        }else if(e.type=='keydown' && cellCursor.keyMoveHandler(e)){
          scope.$apply();
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      });

      var wscope = scope.$root.$new(true);
      wscope.t = cellCursor;
      wscope.$watch('t.selected.cursor',function(v,o){
        cellCursor.drawCursorClass("cursor",v);
      });
      wscope.$watchCollection('[t.selected.topLeft,t.selected.bottomRight]',function(v,o){
        v = v && {topLeft:v[0],bottomRight:v[1]};
        cellCursor.drawAreaClass("area",v);
      });
      wscope.$watch('t.hasFocus',function(v,o){
        elem.toggleClass("focus",v);
      });
      setTimeout(function(){
        emitAndApply(scope,scope)("cellCursor",cellCursor,cellCursor.name);
      });
    }
  };
}])
.directive("cellCursorEditorFrame",['$rootScope',function($rootScope){
  return {
    link:function(scope,elem,attrs){
      elem.css({
        position:'relative'
      }).on('keydown keypress keyup mousedown input compositionstart compositionupdate compositionend',function(e){
        e.stopPropagation();
      });
    }
  };
}])
.directive("cellCursorTextEditor",['$rootScope',function($rootScope){
  return {
    require:'?ngModel',
    link:function(scope,elem,attrs,modelCtrl){
      elem.on("blur",function(){
        scope.finish();
        scope.$apply();
      }).on('keydown', function(e){
        switch(e.which){
          case 9:
            if(scope.cellCursor.keyMoveHandler(e)){
              e.preventDefault();
              scope.$apply();
            }
            break;
          case 27: // ESC
            modelCtrl.$rollbackViewValue();
            scope.finish(modelCtrl.$modelValue);
            scope.$apply();
            e.preventDefault();
            break;
          case 13: // ENTER
            modelCtrl.$commitViewValue();
            scope.finish(modelCtrl.$modelValue);
            scope.$apply();
            e.preventDefault();
            break;
        }
        e.stopPropagation();
      });
      scope.$on('cellCursor.editor.open',function(e,td){
        var st = td.currentStyle || td.ownerDocument.defaultView.getComputedStyle(td, '');
        elem.css({
          "position":"absolute",
          "display":"inline-table",
          "overflow":"hidden",
          "resize":"none",
          "line-height":st.lineHeight,
          "padding":st.padding,
          "border":st.border,
          "background":st.background,
          "box-sizing":st.boxSizing,
          "font-size":st.fontSize,
          "font-family":st.fontFamily,
          "top":"-"+(parseInt(st.borderTopWidth,10)+parseInt(st.paddingTop,10))+"px",
          "left":"-"+(parseInt(st.borderLeftWidth,10)+parseInt(st.paddingTop,10))+"px",
        });
        elem[0].style["white-space"]="nowrap";
        elem[0].style.width=st.width;
        elem[0].style.height=st.height;

        var oldValue = elem[0].value;
        elem[0].focus();
        setTimeout(function(){
          if(oldValue!=elem[0].value){
            modelCtrl.$setViewValue(elem[0].value.substr(oldValue.length));
            elem[0].value = modelCtrl.$viewValue;
          }else{
            elem[0].select();
          }
        });
      });
    }
  };
}])
.service("cellEditorFactory",['$rootScope','$document','$compile',function($rootScope,$document,$compile){
  return {
    "text":{
      cellKey:function(event, options, td, cellCursor){
        if(event.type!="keypress")return;
        if(!event.metaKey && !event.altKey && !event.ctrlKey){
          if((event.which==13 || event.which==113) && !event.shiftKey){ // ENTER OR F2
            if(cellCursor.openEditor(td)){
              event.preventDefault();
              event.stopPropagation();
              return true;
            }
          }
          if(event.which >= 32){
            if(cellCursor.openEditor(td)){
              event.stopPropagation();
              return true;
            }
          }
        }
      },
      open:function(options, td, finish, cellCursor){
        var editorDiv = $('<div cell-cursor-editor-frame="cellCursor"><textarea class="cell-cursor-text-editor" cell-cursor-text-editor="editor"'+
          '  ng-model="options.getterSetter" ng-model-options="{getterSetter:true,updateOn:\'blur\'}"></div>');
        $(td).prepend(editorDiv);
        var s = $rootScope.$new(true);
        s.options=options;
        s.cellCursor = cellCursor;
        editorDiv.find('textarea').val(options.getValue());
        s.finish=function(v){
          if(arguments.length){
            options.setValue(v);
          }
          editorDiv.remove();
          finish();
          setTimeout(function(){
            s.$destroy();
          });
        };
        $compile(editorDiv[0])(s);
        s.$emit('cellCursor.editor.open',td);
      }
    },
    "input":{
      cellKey:function(event, options, td, cellCursor){
        if(!event.shiftKey && !event.metaKey && !event.altKey && !event.ctrlKey){
          switch(event.which){
          case 13: // ENTER
          case 9: // TAB
          case 32: // SPACE
          case 113: // F2
            event.stopPropagation();
            event.preventDefault();
            return cellCursor.openEditor(td);
          }
        }
      },
      open:function(options, td, finish, cellCursor){
        var e = $(td.querySelector(options.getOption().input));
        function keydown(e){
          if(e.which==9){
            cellCursor.focus();
            if(cellCursor.keyMoveHandler(e)){
              e.preventDefault();
              $(td).scope().$apply();
            }
          }
        }
        e.one("blur",function(){
          e.off("keydown",keydown);
          finish();
        }).on("keydown",keydown);
        e[0].focus();
      }
    }
  };
}])
.controller("cellCursorOptionsController",['$scope','$parse','cellEditorFactory',function($scope,$parse,cellEditorFactory){
  this.getOption=function(){
    var o = $parse(this.optionExpression)($scope);
    if(!this.ngModel && o.input){
      var e = this.element.querySelector(o.input);
      if(!e) throw new Error("cellCursorOptionsController:not find element `"+o.input+"`");
      var c = $(e).data().$ngModelController;
      if(!c) throw new Error("cellCursorOptionsController:element `"+o.input+"` "+e+" dose not have ngModel");
      this.ngModel = c;
    }
    if(o.input && !o.editor) o.editor="input";
    return o;
  };
  /** get value. if success get value, return value, else undefined */
  this.getValue=function(){
    return (this.getValueOpt()||[])[0];
  };
  /** get value. if success get value, return [value], else retrun [] */
  this.getValueOpt=function(){
    var o = this.getOption();
    if(o.getter){
      return [o.getter()];
    }else if(o.model){
      return [$parse(o.model)($scope)];
    }else if(this.ngModel){
      return [this.ngModel.$viewValue];
    }else{
      return false;
    }
  };
  /** getterSetter for ngModel */
  this.getterSetter = function(v){
    if(arguments.length){
      this.setValue(v);
    }else{
      return this.getValue();
    }
  };
  /** setValue. if fail (setter not found), then return false */
  this.setValue=function(data){
    var o = this.getOption();
    if(o.setter){
      o.setter(data);
      return true;
    }else if(o.model){
      $parse(o.model).assign($scope,data);
      return true;
    }else if(this.ngModel){
      this.ngModel.$setViewValue(data);
      this.ngModel.$render();
      return true;
    }
    return false;
  };
  this.onCellEvent=function(event, cellCursor, td){
    var o = this.getOption(),t="on"+event.type;
    if(o[t]){
      o[t](event, o, this, cellCursor, td);
      return event.isStopImmediatePropagation();
    }
    if(event.type=='keydown' || event.type=="keypress"||event.type=="keyup"){
      if(o.editor){
        var ef = cellEditorFactory[o.editor];
        if(ef && ef.cellKey){
          return ef.cellKey(event, this, td, cellCursor);
        }
      }
    }
  };
  this.openEditor=function(td, finish, cellCursor){
    var o= this.getOption(), editor = o.editor;
    if(editor){
      var ef = cellEditorFactory[editor];
      if(ef && ef.open){
        ef.open(this,td,finish,cellCursor);
        return true;
      }else{
        throw new Error("cellCursorOptionsController:not found cell-cursor editor '"+editor+"'.open()");
      }
    }
  };
}])
.directive("cellCursorOptions",[function(){
  return {
    restrict:"A",
    require:[
      'cellCursorOptions',
      '?ngModel',
    ],
    controller:'cellCursorOptionsController',
    link:function(scope, elem, attrs, ctrls){
      ctrls[0].optionExpression = attrs.cellCursorOptions;
      ctrls[0].ngModel = ctrls[1];
      ctrls[0].element = elem[0];
    }
  };
}])
.directive("cellCursorDrag",['$parse','$document',function($parse, $document){
  return {
    link:function(scope,elem,attrs){
      var cellCursor = $parse(attrs.cellCursorDrag)(scope);
      elem.on("mousedown",function(event){
        var td = cellCursor.closestCell(event.target);
        if(!td) return;
        var pos = cellCursor.pos(td);
        event.preventDefault();
        event.stopImmediatePropagation();
        emitAndApply(scope,cellCursor)("cellCursor.drag.start",pos);
        function dragHandler(e){
          var target = cellCursor.closestCell(e.target);
          if(!target) return;
          var tpos = cellCursor.pos(target);
          if(pos.row==tpos.row&&pos.col==tpos.col)return;
          emitAndApply(scope,cellCursor)("cellCursor.drag",pos,tpos);
        }
        $document.on('mousemove',dragHandler);
        $document.one('mouseup',function(){
          emitAndApply(scope,cellCursor)("cellCursor.drag.end",pos);
          $document.off('mousemove',dragHandler);
        });
      });
    }
  };
}])
.filter("tsvToCellCursor",[function(){
  return tsvParse;
}])
.filter("cellCursorToTsv",[function(){
  return tsvBuild;
}])
.directive("cellCursorCopy",["$document","$parse",'$window',function($document,$parse,$window){
  return {
    require:'cellCursor',
    link:function(scope, elem, attrs, cellCursor){
      var getter = $parse(attrs.cellCursorCopy);
      $document.on("copy",function(e){
        if(!cellCursor.hasFocus)return;
        var cd = (e.clipboardData||e.originalEvent&&e.originalEvent.clipboardData);
        if(cd){
          cd.setData('text/plain', getter(scope));
          e.preventDefault();
        }else if($window.clipboardData){
          $window.clipboardData.setData('Text', getter(scope));
          e.preventDefault();
        }
      });
    }
  };
}])
.directive("cellCursorPaste",["$document",'$filter','$window',function($document, $filter, $window){
  return {
    require:'cellCursor',
    link:function(scope, elem, attrs, cellCursor){
      $document.on("paste",function(e){
        if(!cellCursor.hasFocus)return;
        var cd = (e.clipboardData||e.originalEvent&&e.originalEvent.clipboardData), data;
        if(cd){
          data = cd.getData('text/plain');
        }else if($window.clipboardData){
          data = $window.clipboardData.getData("Text");
        }
        if(data!==undefined){
          scope.$apply(function () {
            scope.$eval(attrs.cellCursorPaste,{
              "$data":data
            });
          });
        }
      });
    }
  };
}])
.directive("cellCursorColResize",["$document",function($document){
  return {
    require:'^?cellCursor',
    restrict:'C',
    link:function(scope, elem, attrs, cellCursor){
      var td = elem.parent();
      function cols(){
        return $(xpath(td[0],'ancestor::table/*/tr/*['+(td[0].cellIndex+1)+']'));
      }
      var c;
      resizeHandler('cellCursor.colResize', elem, cellCursor, {
        init:function(size){
          c = cols();
        },
        resize:function(size){
          var width = size.width+'px';
          c.css({
            'max-width':width,
            'width':width,
          });
        },
        finish:function(size){
          scope.$apply();
        },
        reset:function(e){
          cols().css({
            'max-width':'',
            'width':''
          });
        }
      });
    }
  };
}])
.directive("cellCursorRowResize",["$document",function($document){
  return {
    require:'^?cellCursor',
    restrict:'C',
    link:function(scope, elem, attrs, cellCursor){
      var td = elem.parent();
      resizeHandler('cellCursor.rowResize', elem, cellCursor, {
        init:function(size){
          td = elem.parent();
        },
        resize:function(size){
          var height = size.height+'px';
          td.parent().css({
            'max-height':height,
            'height':height
          });
        },
        finish:function(size){
          scope.$apply();
        },
        reset:function(e){
          td.parent().css({
            'max-height':'',
            'height':''
          });
        }
      });
    }
  };
}]);

})(angular);