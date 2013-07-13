(function($) {

  var currentNoteView;


  var Note = Backbone.Model.extend({
    baseUrl: 'http://api.markdown-notes.com/notes/node',

    defaults: {
      title:  'untitled',
      type:   'note'
    },

    idAttribute: 'nid',

    url: function() {
      return (this.isNew()) ? this.baseUrl : [this.baseUrl, this.get('nid')].join('/');
    },

    save: function(attributes, options) {
      var body = this.get('body');
      this.set('body', {
        "und": {
          "0": {
            "value": body
          }
        }
      });

      Backbone.Model.prototype.save.apply(this, [attributes, options]);
    },

    get: function(attribute) {
      switch (attribute) {
        case 'body':
          var body = this.attributes['body'];

          if (body && typeof body === 'string') {
            return body;
          } else if (body) {
            return body['und']['0']['value'];
          } else {
            return '';
          }
          break;
        default:
          return Backbone.Model.prototype.get.call(this, attribute);
      }
    }
  });

  var Notes = Backbone.Collection.extend({
    model: Note,
    url: 'http://api.markdown-notes.com/notes/notes'
  });


  $(document).ready(function() {

    var NoteView = Backbone.View.extend({
      id: 'note',
      template: _.template($('#note-template').html()),

      events: {
        'click .save': 'save'
      },

      initialize: function() {
        _.bindAll(this, 'render', 'unrender', 'remove', 'enableSave', 'disableSave', 'save', 'getTitle', 'getBody');
        this.model.bind('change', this.enableSave);
        this.model.bind('remove', this.unrender);
      },

      render: function() {
        var self = this;

        $(this.el).html(this.template({note: this.model}));
        $('[name=title], [name=body]', this.el).on('keyup', function() {
          self.model.set('title', self.getTitle());
          self.model.set('body', self.getBody());
        });

        if (this.model.isNew()) {
          this.enableSave();
        }

        return this;
      },

      unrender: function() {
        $('[name=title], [name=body]', this.el).off('keyup');

        $(this.el).remove();
      },

      save: function() {
        var self = this;

        this.model.save(null, {
          success: self.disableSave,
          error: function() {
            alert('Could not save: ' + self.model.get('title'));
          }
        });
      },

      enableSave: function() {
        $('.save', this.el).removeAttr('disabled');
      },

      disableSave: function() {
        $('.save', this.el).attr('disabled', 'disabled');
      },

      getTitle: function() {
        return $('[name=title]', this.el).val() || 'untitled';
      },

      getBody: function() {
        return $('[name=body]', this.el).val() || ' ';
      }
    });


    var ItemView = Backbone.View.extend({
      tagName: 'li',
      template: _.template($('#item-template').html()),

      events: {
        'click .remove': 'remove',
        'click .view': 'view'
      },

      initialize: function() {
        _.bindAll(this, 'render', 'unrender', 'remove', 'view');

        this.model.bind('change:title', this.render);
        this.model.bind('remove', this.unrender);
      },

      render: function() {
        var self = this;

        $(this.el).html(this.template({note: this.model}));
        return this;
      },

      unrender: function() {
        $(this.el).remove();
      },

      remove: function() {
        this.model.destroy();
      },

      view: function() {
        if (currentNoteView) {
          currentNoteView.remove();
        }

        currentNoteView = new NoteView({
          model: this.model
        });

        $('#main').html(currentNoteView.render().el);
        $('#editor textarea').trigger('keyup');
      }
    });



    var ListView = Backbone.View.extend({
      el: '#sidebar',
      template: _.template($('#list-template').html()),

      events: {
        'click .add': 'add'
      },

      initialize: function() {
        var self = this;
        _.bindAll(this, 'render', 'add', 'append', 'prepend', 'clearInputs');

        this.collection = new Notes();
        this.collection.bind('add', this.prepend);
        this.collection.bind('add', this.clearInputs);

        this.collection.fetch({
          success: self.render
        });
      },

      render: function() {
        var self = this;

        $(this.el).append(this.template());

        _(this.collection.models).each(function(note) {
          self.append(note);
        });
      },

      add: function() {
        var note = new Note({
          title: $('[name=title]', this.el).val() || 'untitled'
        });

        this.collection.add(note);
      },

      append: function(note) {
        var itemView = new ItemView({
          model: note
        });

        $('.list', this.el).append(itemView.render().el);
      },

      prepend: function(note) {
        var itemView = new ItemView({
          model: note
        });

        $('.list', this.el).prepend(itemView.render().el);
      },

      clearInputs: function() {
        $('[name=title]', this.el).val('');
      }
    });

    // Initialize the app
    $('body').prepend(_.template($('#main-template').html())());

    new ListView();

    var converter = new Showdown.converter();
    $('#main').delegate('#editor textarea', 'keyup', function() {
      $('#preview').html(converter.makeHtml($('#editor textarea').val()));
    });

  }); // document.ready

})(jQuery);