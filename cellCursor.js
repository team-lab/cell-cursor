/*eslint-disable *//*jshint globalstrict: true*/
/*global angular, setTimeout, Node */

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
// var isMSIE = typeof(MSEventObj)=='object';

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
/** if old == pos, return old (for object reference-level equality) */
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
    for(var o = this.table[0].getElementsByTagName("COLGROUP"), l = o.length, i=0;i<l;i++){
      if(o[i].parentNode === this.table[0]){
        this._colgroup = o[i];
        break;
      }
    }
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
  var e = angular.element(td);
  var c = e.controller("cellCursorOptions") || e.controller("cellCursorCell");
  if(c){
    var r = c.getValueOpt();
    if(r){
      return r[0];
    }
  }
  c = e.controller("ngModel");
  if(c){
    return c.$viewValue;
  }
};
CellCursor.prototype.setCellValue=function(td, data){
  if(td.hasAttribute("readonly"))return;
  var e = angular.element(td);
  var c = e.controller("cellCursorOptions") || e.controller("cellCursorCell");
  if(c){
    c.setValue(data);
  }else{
    c = e.controller("ngModel");
    if(c){
      c.$setViewValue(data);
    }
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
  var args = {
    pos:pos,
    expanding:expanding,
    size:size,
    selected:this.selected
  };
  var e2 = this.$emit("cellCursor.select.before",args);
  if(e2.defaultPrevented) return false;
  if(args.expanding&&typeof(args.expanding)=='object'){
    expanding=wrapCursor(args.expanding,size);
  }else{
    expanding=args.expanding;
  }
  this.selected.setCurrent(wrapCursor(args.pos,size),expanding);
};
/*function stopCursor(pos, size){
  return {
    col: ((isNaN(pos.col)||pos.col<size.col) ? 0 : ((pos.col>=0) ? size.col-1 : pos.col)),
    row: ((isNaN(pos.row)||pos.row<size.row) ? 0 : ((pos.row>=0) ? size.row-1 : pos.row))
  };
}*/
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
  var pos={row:c.row + (move.row||0), col:c.col + (move.col||0)};
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
  var e = angular.element(td);
  var c = e.controller("cellCursorOptions") || e.controller("cellCursorCell");
  if(c){
    return c.onCellEvent(event,this,td);
  }
};
/** @param td:HTMLTableCellElement */
CellCursor.prototype.openEditor = function(td){
  if(!td){
    td = this.td(this.selected.cursor);
    if(!td) return;
  }
  var e = angular.element(td);
  var c = e.controller("cellCursorOptions") || e.controller("cellCursorCell");
  if(c){
    var self = this;
    var e2 = self.$emit('cellCursor.editor.opening', td, c);
    if(e2.defaultPrevented) return;
    return  c.openEditor(td,function(){
      self.focus();
      self.$emit('cellCursor.editor.finished', td, c);
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
  var b,r,td,tr,c;
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
/**
 * redraw cursor, area classes at table cell.
 */
CellCursor.prototype.redraw = function(){
  var v = this.selected;
  this.drawCursorClass("cursor",v.cursor);
  this.drawAreaClass("area",v);
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
function resizeHandler(name, elem, cellCursor, data, handler){
  var td = elem.parent();
  while(typeof(td[0].cellIndex)=='undefined'){
    td = td.parent();
    if(td.length===0){
      throw new Error(name + " need to be child of td or th");
    }
  }
  var $document = angular.element(elem[0].ownerDocument);
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
      var e2 = cellCursor.$emit(name+".start", pos, tdSize(), data);
      if(e2.defaultPrevented) return false;
    }
    handler.init(base);
    base.width -= e.pageX;
    base.height -= e.pageY;
    stopEvent(e);
    function dragHandler(e){
      var size = {
        width:base.width+e.pageX,
        height:base.height+e.pageY
      };
      if(cellCursor){
        var e2 = cellCursor.$emit(name+".resizing", pos, size, tdSize(), data);
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
      if(cellCursor) cellCursor.$emit(name + ".end", pos, tdSize(), data);
      $document.off('mousemove',dragHandler);
    });
  }).on('dblclick',function(e){
    if(cellCursor){
      var e2 = cellCursor.$emit(name+".reset", tdPos(), tdSize(), data);
      if(e2.defaultPrevented) return false;
    }
    stopEvent(e);
    handler.reset(e);
  }).on('click',function(e){
    stopEvent(e);
  });
  return td;
}

/** propertyMethod('set','hoge.name') => 'huge.setName' */
function propertyMethod(prefix, name){
  return name.replace(/(\.|^)([a-zA-Z0-9]+)$/,function(model, pre, method){
    return pre+prefix+method.substr(0,1).toUpperCase()+method.substr(1);
  });
}

angular.module("cellCursor",[])
.factory("CellCursor",function(){
  return CellCursor;
})
.service("cellCursorUtil",[function(){
  return {
    isKeyAcceptElement:isKeyAcceptElement,
    propertyMethod:propertyMethod
  };
}])
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
        cellCursor.$emit("cellCursor.select.after");
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
      }).on('keydown keypress keyup mousedown mouseup input compositionstart compositionupdate compositionend paste copy click dblclick',function(e){
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
        scope.$applyAsync();
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
            if(e.shiftKey||e.ctrlKey||e.metaKey||e.altKey) break;
            modelCtrl.$commitViewValue();
            scope.finish(modelCtrl.$modelValue);
            scope.$apply();
            e.preventDefault();
            break;
        }
        e.stopPropagation();
        expandWidth();
      });
      function expandWidth(){
        if(elem[0].scrollWidth>elem[0].offsetWidth){
          elem.css("width",elem[0].scrollWidth+70+"px");
        }
      }
      scope.$on('cellCursor.editor.open',function(e,td){
        var st = td.currentStyle || td.ownerDocument.defaultView.getComputedStyle(td, '');
        var rect = td.getBoundingClientRect();
        elem.css({
          "position":"fixed",
          "zIndex":1,
          "display":"inline-table",
          "overflow":"hidden",
          "resize":"none",
          "line-height":st.lineHeight,
          "padding":st.padding,
          "border":st.border,
          "background":st.background,
          "box-sizing":st.boxSizing,
          "vertical-align":st.verticalAlign,
          "font-size":st.fontSize,
          "font-family":st.fontFamily,
          "white-space":"pre",
          "top":rect.top+"px",
          "left":rect.left+"px",
          "width":st.width,
          "height":st.height
        });
        var r2 = elem[0].getBoundingClientRect();
        elem[0].style.top=(rect.top*2-r2.top)+'px';
        elem[0].style.left=(rect.left*2-r2.left)+'px';
        var oldValue = elem.val();
        elem[0].focus();
        setTimeout(function(){
          if(oldValue!=elem.val()){
            modelCtrl.$setViewValue(elem.val().substr(oldValue.length));
            elem.val(modelCtrl.$viewValue);
          }else{
            elem[0].select();
          }
          expandWidth();
        });
      });
    }
  };
}])
.service("cellEditorText",['$rootScope','$compile',function($rootScope,$compile){
  return {
    template:'<div cell-cursor-editor-frame="cellCursor">'+
      '<textarea type="text" class="cell-cursor-text-editor" wrap="off" style="position:fixed;z-index:1" cell-cursor-text-editor="editor"'+
      ' ng-trim="false" ng-model="options.getterSetter" ng-model-options="{getterSetter:true,updateOn:\'blur\'}">'+
      '</textarea></div>',
    setValue:function(editorDiv, value){
      editorDiv.find('textarea').val(value);
    },
    /** override cell-editor interface */
    cellKey:function(event, options, td, cellCursor){
      if(!event.metaKey && !event.altKey && !event.ctrlKey){
        if(event.type=="keydown"&&
          (event.which==13/*ENTER*/ || event.which==113/* F2 */) && !event.shiftKey){
          if(cellCursor.openEditor(td)){
            event.preventDefault();
            event.stopPropagation();
            return true;
          }
        }
        if(event.type=="keypress"&& event.which >= 32){
          if(cellCursor.openEditor(td)){
            event.stopPropagation();
            return true;
          }
        }
      }
    },
    /** override cell-editor interface */
    open:function(options, td, finish, cellCursor){
      var s = $rootScope.$new(true);
      s.options=options;
      s.cellCursor = cellCursor;
      /** set value and close editor. */
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
      var editorDiv = $(this.template);
      $(td).prepend(editorDiv);
      this.setValue(editorDiv, options.getValue());
      $compile(editorDiv[0])(s);
      s.$emit('cellCursor.editor.open', td);
    }
  };
}])
.service("cellEditorInput",[function(){
  return {
    /** override cell-editor interface */
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
    /** override cell-editor interface */
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
  };
}])
.service("cellEditorFactory",['cellEditorText','cellEditorInput',function(cellEditorText,cellEditorInput){
  return {
    "text":cellEditorText,
    "input":cellEditorInput
  };
}])
.controller("cellCursorOptionsController",['$scope','$parse','cellEditorFactory',function($scope,$parse,cellEditorFactory){
  this.getOption=function(){
    var o = $parse(this.optionExpression)($scope);
    if(this.ngModel===undefined && o.input){
      var e = this.element.querySelector(o.input);
      if(!e) throw new Error("cellCursorOptionsController:not find element `"+o.input+"`");
      var c = $(e).data().$ngModelController;
      this.ngModel = c || null;
    }
    if(o.input && !o.editor) o.editor="input";
    return o;
  };
  /** get value. if success get value, return value, else undefined */
  this.getValue=function(){
    return (this.getValueOpt()||[])[0];
  };
  /** get value. if success get value, return [value], else retrun [] (can tell 'fail get value' from 'return false' ) */
  this.getValueOpt=function(){
    var o = this.getOption();
    if(o.getter){
      if(typeof(o.getter)=='function'){
        return [o.getter()];
      }else if(typeof(o.getter)=='string'){
        return [$scope.$eval(o.getter)];
      }else if(typeof(o.getter)=='boolean'){
        if(o.getter){
          return [$scope.$eval(propertyMethod('get',o.model)+'()')];
        }else{
          return false;
        }
      }
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
    if(this.isLocked()) return true;
    var o = this.getOption();
    if(o.setter){
      if(typeof(o.setter)=='function'){
        return [o.setter(data)];
      }else if(typeof(o.setter)=='string'){
        return [$scope.$eval(o.setter,{$data:data})];
      }else if(typeof(o.setter)=='boolean'){
        if(o.setter){
          return $scope.$eval(propertyMethod('set',o.model)+'($data)',{$data:data});
        }else{
          return true;
        }
      }
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
  /** if isLocked return true, then setValue is not work. */
  this.isLocked=function(){
    var o = this.getOption();
    if(o.locked){
      if(typeof(o.locked)=='function'){
        return o.locked();
      }else if(typeof(o.locked)=='string'){
        return $scope.$eval(o.locked);
      }else if(typeof(o.locked)=='boolean'){
        return o.locked;
      }
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
      if(this.isLocked()) return true;
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
      '?ngModel'
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
    restrict:'CA',
    link:function(scope, elem, attrs, cellCursor){
      elem.addClass("cell-cursor-col-resize");
      function cols(){
        return $(td[0]).closest("table").children().children("tr").children("*:nth-child("+(td[0].cellIndex+1)+")");
      }
      var c;
      var td = resizeHandler('cellCursor.colResize', elem, cellCursor, scope.$eval(attrs.cellCursorColResize), {
        init:function(size){
          c = cols();
        },
        resize:function(size){
          var width = size.width+'px';
          c.css({
            'max-width':width,
            'min-width':width
          });
        },
        finish:function(size){
          scope.$apply();
        },
        reset:function(e){
          cols().css({
            'max-width':'',
            'min-width':''
          });
        }
      });
    }
  };
}])
.directive("cellCursorRowResize",["$document",function($document){
  return {
    require:'^?cellCursor',
    restrict:'CA',
    link:function(scope, elem, attrs, cellCursor){
      elem.addClass("cell-cursor-row-resize");
      var td = resizeHandler('cellCursor.rowResize', elem, cellCursor, scope.$eval(attrs.cellCursorRowResize), {
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
}])
.directive("cellCursorCell",["ngIfDirective",function(ngIfDirective){
  function setWidth(v,elem){
    elem.css((v===undefined)?
      {
        'max-width':'',
        'min-width':''
      } : {
        'max-width':v+"px",
        'min-width':v+"px"
      });
  }
  var ngIf=ngIfDirective[0];
  return {
    transclude:ngIf.transclude,
    terminal:ngIf.terminal,
    priority:ngIf.priority,
    require:[
      'cellCursorCell',
      '?ngModel'
    ],
    controller:'cellCursorOptionsController',
    compile:function(elem,attrs){
    return function(scope, elem, attrs, ctrls, $transclude){
      var opt = ctrls[0];
      opt.optionExpression = attrs.cellCursorCell;
      opt.ngModel = ctrls[1];
      opt.element = elem[0];
      var block=null, width;
      scope.$watch(attrs.cellCursorCell+".width",function(v){
        width = v;
        if(block){
          setWidth(v, block);
        }
      });
      var ev = "!"+attrs.cellCursorCell+".hide";
      if(attrs.ngIf){
        ev = ev + "&&("+attrs.ngIf+")";
      }
      attrs.ngIf=ev;
      ngIf.link(scope, elem, attrs, ctrls, $transclude);
      scope.$watch(ev,function(v){
        if(v){
          block=elem.next();
          opt.element=block;
          setWidth(width,block);
        }else{
          block=null;
          opt.element=elem;
        }
      });
    };
    }
  };
}])
;

})(angular);